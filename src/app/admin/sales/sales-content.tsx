'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Contract, Vehicle, Customer } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore, useMemoFirebase, useUserRole } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Download, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalesPageContent() {
  const firestore = useFirestore();
  const { isPlatformAdmin } = useUserRole();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [searchText, setSearchText] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Leggi parametri di data
  const dateFromParam = searchParams.get('dateFrom');
  const dateToParam = searchParams.get('dateTo');

  // Fetch contracts
  const contractsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return isPlatformAdmin
      ? query(collection(firestore, 'contracts'), orderBy('createdAt', 'desc'))
      : query(collection(firestore, 'contracts'), where('adminOnly', '==', false));
  }, [firestore, isPlatformAdmin]);

  const { data: contracts = [] } = useCollection<Contract>(contractsRef);

  // Fetch vehicles for lookup
  const vehiclesRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return isPlatformAdmin
      ? collection(firestore, 'vehicles')
      : query(collection(firestore, 'vehicles'), where('adminOnly', '==', false));
  }, [firestore, isPlatformAdmin]);

  const { data: vehicles = [] } = useCollection<Vehicle>(vehiclesRef);

  // Fetch customers
  const customersRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return isPlatformAdmin
      ? collection(firestore, 'customers')
      : query(collection(firestore, 'customers'), where('adminOnly', '==', false));
  }, [firestore, isPlatformAdmin]);

  const { data: customers = [] } = useCollection<Customer>(customersRef);

  // Filter contracts based on search and date range
  const filteredContracts = useMemo(() => {
    const contractsArray = Array.isArray(contracts) ? contracts : [];
    let filtered = [...contractsArray];

    // Filtro per data
    if (dateFromParam || dateToParam) {
      const dateFrom = dateFromParam ? new Date(dateFromParam) : new Date('2000-01-01');
      const dateTo = dateToParam ? new Date(dateToParam) : new Date('2099-12-31');
      
      filtered = filtered.filter(c => {
        if (!c.createdAt) return false;
        const contractDate = c.createdAt.toDate?.();
        if (!contractDate) return false;
        return contractDate >= dateFrom && contractDate <= dateTo;
      });
    }

    // Filtro per ricerca testo
    if (searchText.trim()) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.cf.toLowerCase().includes(search) ||
        c.email?.toLowerCase().includes(search) ||
        c.phone?.toLowerCase().includes(search)
      );
    }

    return filtered.sort((first, second) =>
      (second.createdAt?.toDate?.()?.getTime() ?? 0) - (first.createdAt?.toDate?.()?.getTime() ?? 0)
    );
  }, [contracts, searchText, dateFromParam, dateToParam]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredContracts.reduce((acc, contract) => ({
      vendite: acc.vendite + (contract.vehicleSalePrice || 0),
      costi: acc.costi + (
        (contract.vehicleCostPrice || 0) +
        (contract.costiShipping || 0) +
        (contract.costiAllestimento || 0) +
        (contract.costiPratiche || 0)
      ),
      ricavi: acc.ricavi + (contract.ricaviCommissioni || 0),
      count: acc.count + 1,
    }), { vendite: 0, costi: 0, ricavi: 0, count: 0 });
  }, [filteredContracts]);

  const profitto = useMemo(() => {
    return totals.vendite - totals.costi + totals.ricavi;
  }, [totals]);

  // Generate PDF report
  const generatePDFReport = async () => {
    setIsGeneratingReport(true);
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;

      // Header
      pdf.setFontSize(20);
      pdf.text('Report Vendite', margin, 20);
      
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`Generato: ${new Date().toLocaleDateString('it-IT')}`, margin, 28);
      if (dateFromParam || dateToParam) {
        const rangeText = `Periodo: ${dateFromParam || 'inizio'} → ${dateToParam || 'oggi'}`;
        pdf.text(rangeText, margin, 33);
        pdf.text(`Totale contratti: ${filteredContracts.length}`, margin, 38);
      } else {
        pdf.text(`Totale contratti: ${filteredContracts.length}`, margin, 33);
      }

      // Summary
      pdf.setFontSize(12);
      pdf.setTextColor(0);
      pdf.text('Riepilogo Finanziario', margin, dateFromParam || dateToParam ? 45 : 45);

      const summaryData = [
        ['Metrica', 'Importo'],
        ['Vendite Totali', formatCurrency(totals.vendite)],
        ['Costi Totali', formatCurrency(totals.costi)],
        ['Ricavi Aggiuntivi', formatCurrency(totals.ricavi)],
        ['Profitto Netto', formatCurrency(profitto)],
      ];

      autoTable(pdf, {
        startY: 50,
        head: [summaryData[0]],
        body: summaryData.slice(1),
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [59, 130, 246] },
        bodyStyles: { fontSize: 10 },
      });

      // Contracts table
      const tableData = filteredContracts.map(contract => [
        contract.createdAt 
          ? new Date(contract.createdAt.toDate?.()).toLocaleDateString('it-IT')
          : 'N/D',
        contract.name,
        contract.customerType === 'privato' ? 'Privato' : 'Commerciante',
        formatCurrency(contract.vehicleSalePrice || 0),
        formatCurrency((contract.vehicleCostPrice || 0) + (contract.costiShipping || 0) + (contract.costiAllestimento || 0) + (contract.costiPratiche || 0)),
        formatCurrency((contract.vehicleSalePrice || 0) - ((contract.vehicleCostPrice || 0) + (contract.costiShipping || 0) + (contract.costiAllestimento || 0) + (contract.costiPratiche || 0)) + (contract.ricaviCommissioni || 0)),
      ]);

      autoTable(pdf, {
        startY: (pdf as any).lastAutoTable.finalY + 10,
        head: [['Data', 'Cliente', 'Tipo', 'Prezzo Vendita', 'Costi Totali', 'Profitto']],
        body: tableData,
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [59, 130, 246] },
        bodyStyles: { fontSize: 9 },
      });

      const dateRange = (dateFromParam || dateToParam) 
        ? `-${dateFromParam || 'all'}-${dateToParam || 'today'}`
        : '';
      pdf.save(`vendite${dateRange}-${new Date().toISOString().split('T')[0]}.pdf`);
      toast({
        title: 'Report generato',
        description: 'Il file PDF è stato scaricato con successo.',
      });
    } catch (error) {
      console.error('Errore generazione report:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile generare il report.',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const dateFromDisplay = dateFromParam ? new Date(dateFromParam).toLocaleDateString('it-IT') : null;
  const dateToDisplay = dateToParam ? new Date(dateToParam).toLocaleDateString('it-IT') : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-8">
        {/* Header con back button */}
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Indietro
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Cronologia Vendite</h1>
            <p className="text-muted-foreground mt-1">
              {dateFromDisplay || dateToDisplay 
                ? `Periodo: ${dateFromDisplay || 'inizio'} → ${dateToDisplay || 'oggi'}`
                : 'Visualizza e gestisci tutte le vendite e i contratti'}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contratti Totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.count}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Vendite Totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.vendite)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Costi Totali</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totals.costi)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Profitto Netto</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${profitto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(profitto)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Download */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Input
            placeholder="Cerca per nome, CF, email, telefono..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={generatePDFReport}
            disabled={isGeneratingReport || filteredContracts.length === 0}
            className="gap-2 whitespace-nowrap"
          >
            {isGeneratingReport ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generazione...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Scarica PDF
              </>
            )}
          </Button>
        </div>

        {/* Contracts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Vendite ({filteredContracts.length})</CardTitle>
            <CardDescription>
              Lista completa di tutti i contratti e i dati finanziari
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Prezzo Vendita</TableHead>
                    <TableHead className="text-right">Costi</TableHead>
                    <TableHead className="text-right">Ricavi Add.</TableHead>
                    <TableHead className="text-right">Profitto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {searchText ? 'Nessun risultato per la ricerca' : 'Nessun contratto trovato'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContracts.map(contract => {
                      const totalCosts = (contract.vehicleCostPrice || 0) + 
                        (contract.costiShipping || 0) + 
                        (contract.costiAllestimento || 0) + 
                        (contract.costiPratiche || 0);
                      const profitForContract = (contract.vehicleSalePrice || 0) - totalCosts + (contract.ricaviCommissioni || 0);
                      
                      return (
                        <TableRow key={contract.id}>
                          <TableCell className="font-medium">
                            {contract.createdAt 
                              ? new Date(contract.createdAt.toDate?.()).toLocaleDateString('it-IT')
                              : 'N/D'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="font-medium">{contract.name}</div>
                              <div className="text-xs text-muted-foreground">{contract.email || contract.phone || 'N/D'}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={contract.customerType === 'privato' ? 'secondary' : 'default'}>
                              {contract.customerType === 'privato' ? 'Privato' : 'Commerciante'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(contract.vehicleSalePrice || 0)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 font-semibold">
                            {formatCurrency(totalCosts)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-semibold">
                            {formatCurrency(contract.ricaviCommissioni || 0)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            <span className={profitForContract >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatCurrency(profitForContract)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
