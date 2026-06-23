'use client';

import React, { useEffect, useState } from 'react';
import { collection, doc } from 'firebase/firestore';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Shield, Trash2, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import * as z from 'zod';

import type { AgentProfile } from '@/lib/types';
import {
  deleteDocumentNonBlocking,
  updateDocumentNonBlocking,
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from '@/firebase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  AGENT_REPORTS_SECTION,
  DEFAULT_AGENT_REPORT_CAPABILITIES,
} from '@/lib/agent-permissions';

const registerSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio.'),
  email: z.string().email('Inserisci un indirizzo email valido.'),
  password: z.string().min(6, 'La password deve contenere almeno 6 caratteri.'),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AgentsPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const agentsRef = useMemoFirebase(
    () => (firestore ? collection(firestore, 'agents') : null),
    [firestore]
  );
  const { data: agents, isLoading, error } = useCollection<AgentProfile>(agentsRef);
  const [agentToDelete, setAgentToDelete] = useState<AgentProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const registrationForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!error) {
      return;
    }

    toast({
      variant: 'destructive',
      title: 'Errore nel caricamento degli agenti',
      description: 'Impossibile recuperare la lista agenti. Controlla i permessi o la console per i dettagli.',
    });
    console.error('Firestore Error:', error);
  }, [error, toast]);

  async function onRegisterSubmit(data: RegisterFormValues) {
    if (!currentUser) {
      toast({
        variant: 'destructive',
        title: 'Sessione non valida',
        description: 'Devi essere autenticato come admin per creare un agente.',
      });
      return;
    }

    setIsRegistering(true);

    try {
      const adminIdToken = await currentUser.getIdToken();
      const response = await fetch('/api/admin/register-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminIdToken}`,
        },
        body: JSON.stringify(data),
      });

      const result = (await response.json().catch(() => null)) as
        | { error?: string; success?: boolean }
        | null;

      if (!response.ok) {
        throw new Error(result?.error || 'AGENT_CREATE_FAILED');
      }

      toast({
        title: 'Agente registrato',
        description: `L'account ${data.email} è stato creato. Le autorizzazioni restano in stato pending finché non deciderai cosa può vedere o fare.`,
      });

      registrationForm.reset();
      setIsDialogOpen(false);
      router.refresh();
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'AGENT_CREATE_FAILED';
      let description = 'Si è verificato un errore imprevisto.';

      if (errorCode === 'EMAIL_EXISTS') {
        description = 'Questo indirizzo email è già stato registrato.';
      } else if (errorCode === 'INVALID_EMAIL') {
        description = 'L’indirizzo email non è valido.';
      } else if (errorCode === 'WEAK_PASSWORD') {
        description = 'La password è troppo debole. Inserisci almeno 6 caratteri.';
      } else if (errorCode === 'FORBIDDEN' || errorCode === 'UNAUTHORIZED') {
        description = 'Solo un admin può creare agenti.';
      } else if (errorCode === 'INVALID_PAYLOAD') {
        description = 'Compila correttamente nome, email e password.';
      } else if (error instanceof Error) {
        description = error.message;
      }

      toast({
        variant: 'destructive',
        title: 'Registrazione agente fallita',
        description,
      });
    } finally {
      setIsRegistering(false);
    }
  }

  const handleDeleteConfirm = async () => {
    if (!agentToDelete || !firestore) {
      return;
    }

    setIsDeleting(true);
    const agentDocRef = doc(firestore, 'agents', agentToDelete.id);
    deleteDocumentNonBlocking(agentDocRef)
      .then(() => {
        toast({
          title: 'Agente rimosso',
          description: `Il profilo ${agentToDelete.email} è stato rimosso dalla lista agenti.`,
        });
      })
      .catch(() => {
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile eliminare il profilo agente.',
        });
      })
      .finally(() => {
        setIsDeleting(false);
        setAgentToDelete(null);
      });
  };

  const handleStatusChange = (agentId: string, status: 'pending' | 'active' | 'disabled') => {
    if (!firestore) {
      return;
    }

    setIsUpdating(agentId);
    const agentDocRef = doc(firestore, 'agents', agentId);
    updateDocumentNonBlocking(agentDocRef, { status, updatedAt: new Date().toISOString() })
      .then(() => {
        toast({ title: 'Stato agente aggiornato' });
      })
      .catch(error => {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare lo stato dell’agente.',
        });
      })
      .finally(() => {
        setIsUpdating(null);
      });
  };

  const handleReportAccessChange = (agentId: string, enabled: boolean) => {
    if (!firestore) {
      return;
    }

    setIsUpdating(agentId);
    const agentDocRef = doc(firestore, 'agents', agentId);
    updateDocumentNonBlocking(agentDocRef, {
      allowedSections: enabled ? [AGENT_REPORTS_SECTION] : [],
      capabilities: enabled ? [...DEFAULT_AGENT_REPORT_CAPABILITIES] : [],
      updatedAt: new Date().toISOString(),
    })
      .then(() => {
        toast({ title: enabled ? 'Accesso pratiche abilitato' : 'Accesso pratiche disabilitato' });
      })
      .catch(error => {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: 'Impossibile aggiornare i permessi dell’agente.',
        });
      })
      .finally(() => {
        setIsUpdating(null);
      });
  };

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">Gestione Agenti</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea gli account agente ora. Le autorizzazioni operative verranno definite in un secondo momento.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Aggiungi Agente
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-[425px] sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Registra Nuovo Agente</DialogTitle>
                <DialogDescription>
                  Crea un account agente come avviene per i seller. I permessi partono in stato pending.
                </DialogDescription>
              </DialogHeader>
              <Form {...registrationForm}>
                <form onSubmit={registrationForm.handleSubmit(onRegisterSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={registrationForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input placeholder="Mario Rossi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registrationForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="nome@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registrationForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Minimo 6 caratteri" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isRegistering}>
                        Annulla
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={isRegistering}>
                      {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Registra
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Alert className="mb-6 border-amber-200 bg-amber-50 text-amber-950">
          <Shield className="h-4 w-4" />
          <AlertTitle>Permessi non ancora assegnati</AlertTitle>
          <AlertDescription>
            La sezione crea l’anagrafica e l’account agente. Le regole di cosa può vedere o fare restano volutamente da configurare dopo le tue indicazioni.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Completo</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Area Sinistri</TableHead>
                <TableHead>Permessi</TableHead>
                <TableHead className="min-w-[90px] text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-10 ml-auto" /></TableCell>
                  </TableRow>
                ))}
              {!isLoading && error && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-destructive">
                    Si è verificato un errore nel caricamento degli agenti.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && agents && agents.length > 0 ? (
                agents.map(agent => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.nome || agent.name || '(Nome non specificato)'}</TableCell>
                    <TableCell className="font-medium">{agent.email || '(Email non specificata)'}</TableCell>
                    <TableCell>
                      {isUpdating === agent.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Select
                          value={agent.status || 'pending'}
                          onValueChange={(value: 'pending' | 'active' | 'disabled') => handleStatusChange(agent.id, value)}
                        >
                          <SelectTrigger className="w-full min-w-[150px] sm:w-[180px]">
                            <SelectValue placeholder="Seleziona stato" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="disabled">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {isUpdating === agent.id ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Select
                          value={agent.allowedSections?.includes(AGENT_REPORTS_SECTION) ? 'enabled' : 'disabled'}
                          onValueChange={(value: 'enabled' | 'disabled') => handleReportAccessChange(agent.id, value === 'enabled')}
                        >
                          <SelectTrigger className="w-full min-w-[150px] sm:w-[180px]">
                            <SelectValue placeholder="Configura accesso" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disabled">Disabilitato</SelectItem>
                            <SelectItem value="enabled">Abilitato</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {(agent.capabilities?.length || 0) > 0 ? `${agent.capabilities?.length} configurati` : 'Da definire'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setAgentToDelete(agent)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                !isLoading && !error && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nessun agente trovato.
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!agentToDelete} onOpenChange={open => !open && setAgentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione rimuoverà il profilo agente dalla collection dedicata. L’account di autenticazione non verrà eliminato in questa fase.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Eliminazione...' : 'Conferma'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}