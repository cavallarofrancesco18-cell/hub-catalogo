'use client';

import { collection, doc } from 'firebase/firestore';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { Eye, FileText, Loader2 } from 'lucide-react';

import type { AgentProfile, AgentVehicleReport } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import {
  updateDocumentNonBlocking,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const reportStatusLabels: Record<AgentVehicleReport['status'], string> = {
  new: 'Nuova',
  reviewed: 'Presa in carico',
  archived: 'Archiviata',
};

export default function AdminAgentReportsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<AgentVehicleReport | null>(null);
  const [updatingReportId, setUpdatingReportId] = useState<string | null>(null);

  const reportsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'agentVehicleReports') : null),
    [firestore]
  );
  const agentsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'agents') : null),
    [firestore]
  );

  const { data: reports, isLoading: reportsLoading, error: reportsError } = useCollection<AgentVehicleReport>(reportsRef);
  const { data: agents } = useCollection<AgentProfile>(agentsRef);

  const agentsById = useMemo(() => {
    return new Map((agents ?? []).map(agent => [agent.id, agent] as const));
  }, [agents]);

  const sortedReports = useMemo(() => {
    return [...(reports ?? [])].sort((left, right) => {
      const leftDate = left.createdAt?.seconds ? left.createdAt.seconds : 0;
      const rightDate = right.createdAt?.seconds ? right.createdAt.seconds : 0;
      return rightDate - leftDate;
    });
  }, [reports]);

  const handleStatusChange = (reportId: string, status: AgentVehicleReport['status']) => {
    if (!firestore) {
      return;
    }

    setUpdatingReportId(reportId);
    const reportDocRef = doc(firestore, 'agentVehicleReports', reportId);
    updateDocumentNonBlocking(reportDocRef, {
      status,
      updatedAt: new Date().toISOString(),
    })
      .then(() => {
        toast({ title: 'Stato pratica aggiornato' });
      })
      .catch(error => {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare lo stato della pratica.',
        });
      })
      .finally(() => {
        setUpdatingReportId(null);
      });
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-headline">Pratiche Agenti</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tutte le vetture sinistrate caricate dagli agenti restano qui, separate dal catalogo di vendita e visibili solo agli admin.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Archivio pratiche</CardTitle>
            <CardDescription>
              Consulta foto, danni e allegati inviati dagli agenti, poi imposta lo stato operativo della pratica.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veicolo</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Sinistro</TableHead>
                  <TableHead>Foto</TableHead>
                  <TableHead>Allegati</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportsLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                )}
                {!reportsLoading && reportsError && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-destructive">
                      Errore nel caricamento delle pratiche agenti.
                    </TableCell>
                  </TableRow>
                )}
                {!reportsLoading && !reportsError && sortedReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Nessuna pratica agente presente.
                    </TableCell>
                  </TableRow>
                )}
                {sortedReports.map(report => {
                  const agent = agentsById.get(report.agentId);
                  const coverImage = report.damageImages?.[0] || report.vehicleImages?.[0] || '';

                  return (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative h-14 w-20 overflow-hidden rounded-md border bg-muted">
                            {coverImage ? (
                              <Image src={coverImage} alt={`${report.marca} ${report.modello}`} fill className="object-cover" unoptimized />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium">{report.marca} {report.modello}</p>
                            <p className="text-sm text-muted-foreground">{report.versione} · {report.targa}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{agent?.nome || agent?.name || report.agentEmail || 'Agente'}</p>
                          <p className="text-sm text-muted-foreground">{report.agentEmail || agent?.email || 'Email non disponibile'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.tipoSinistro}</Badge>
                      </TableCell>
                      <TableCell>{(report.vehicleImages?.length || 0) + (report.damageImages?.length || 0)}</TableCell>
                      <TableCell>{report.attachments?.length || 0}</TableCell>
                      <TableCell>
                        {updatingReportId === report.id ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Select value={report.status} onValueChange={(value: AgentVehicleReport['status']) => handleStatusChange(report.id, value)}>
                            <SelectTrigger className="w-full min-w-[150px] sm:w-[180px]">
                              <SelectValue placeholder="Seleziona stato" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Nuova</SelectItem>
                              <SelectItem value="reviewed">Presa in carico</SelectItem>
                              <SelectItem value="archived">Archiviata</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedReport(report)}>
                          <Eye className="mr-2 h-4 w-4" />
                          Apri
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedReport} onOpenChange={open => !open && setSelectedReport(null)}>
        <DialogContent className="w-[95vw] max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selectedReport ? `${selectedReport.marca} ${selectedReport.modello} - ${selectedReport.targa}` : 'Dettaglio pratica'}
            </DialogTitle>
            <DialogDescription>
              {selectedReport ? `${reportStatusLabels[selectedReport.status]} · ${selectedReport.tipoSinistro}` : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-8">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Veicolo</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{selectedReport.versione}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Immatricolazione</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{new Date(selectedReport.data_immatricolazione).toLocaleDateString('it-IT')}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Km</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{selectedReport.chilometraggio ?? 'N/D'}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Stato</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">{reportStatusLabels[selectedReport.status]}</CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Descrizione sinistro</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-foreground/90">{selectedReport.descrizione}</p>
                </CardContent>
              </Card>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Foto vettura</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedReport.vehicleImages?.map(url => (
                      <div key={url} className="relative aspect-[16/9] overflow-hidden rounded-lg border">
                        <Image src={url} alt="Foto vettura" fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Foto danni</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedReport.damageImages?.map(url => (
                      <div key={url} className="relative aspect-[16/9] overflow-hidden rounded-lg border">
                        <Image src={url} alt="Foto danni" fill className="object-cover" unoptimized />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Allegati</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedReport.attachments?.length ? selectedReport.attachments.map(attachment => (
                    <a
                      key={attachment.url}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/40"
                    >
                      <div>
                        <p className="text-sm font-medium">{attachment.filename}</p>
                        <p className="text-sm text-muted-foreground">{attachment.type}</p>
                      </div>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </a>
                  )) : (
                    <p className="text-sm text-muted-foreground">Nessun allegato presente.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}