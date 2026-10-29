'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import Link from 'next/link';
import { useFirestore, useUser, useUserRole } from '@/firebase';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Search, Download, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Customer, Contract, Vehicle } from '@/lib/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function CustomersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { isPlatformAdmin } = useUserRole();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<(Customer & { purchases: (Contract & { vehicle?: Vehicle })[] })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<(Customer & { purchases: (Contract & { vehicle?: Vehicle })[] }) | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '',
    customerType: 'privato',
    cf: '',
    address: '',
    email: '',
    phone: '',
    docNumber: '',
    birthDate: '',
    birthPlace: '',
  });

  const isLegacyCustomer = (customerId: string) => customerId.startsWith('legacy-');

  useEffect(() => {
    loadCustomers();
  }, [firestore, isPlatformAdmin]);

  const loadCustomers = async () => {
    if (!firestore) return;

    setIsLoading(true);
    try {
      const [customersSnapshot, contractsSnapshot, vehiclesSnapshot] = await Promise.all([
        getDocs(isPlatformAdmin
          ? query(collection(firestore, 'customers'))
          : query(collection(firestore, 'customers'), where('adminOnly', '==', false))),
        getDocs(isPlatformAdmin
          ? query(collection(firestore, 'contracts'))
          : query(collection(firestore, 'contracts'), where('adminOnly', '==', false))),
        getDocs(isPlatformAdmin
          ? query(collection(firestore, 'vehicles'))
          : query(collection(firestore, 'vehicles'), where('adminOnly', '==', false))),
      ]);

      const vehicleMap = new Map<string, Vehicle>();
      vehiclesSnapshot.docs.forEach(vehicleDoc => {
        vehicleMap.set(vehicleDoc.id, {
          ...(vehicleDoc.data() as Vehicle),
          id: vehicleDoc.id,
        });
      });

      const customerMap = new Map<string, Customer & { purchases: (Contract & { vehicle?: Vehicle })[] }>();
      customersSnapshot.docs.forEach(customerDoc => {
        customerMap.set(customerDoc.id, {
          ...(customerDoc.data() as Customer),
          id: customerDoc.id,
          purchases: [],
        });
      });

      const findCustomerByCf = (cf: string | undefined | null) => {
        if (!cf) return null;
        const normalized = cf.trim().toLowerCase();
        for (const entry of customerMap.values()) {
          if ((entry.cf || '').trim().toLowerCase() === normalized) {
            return entry;
          }
        }
        return null;
      };

      contractsSnapshot.docs.forEach(contractDoc => {
        const contractData = contractDoc.data() as Contract;
        const contractWithVehicle: Contract & { vehicle?: Vehicle } = {
          ...contractData,
          id: contractDoc.id,
          vehicle: contractData.vehicleId ? vehicleMap.get(contractData.vehicleId) : undefined,
        };

        const linkedCustomerById = contractData.customerId
          ? customerMap.get(contractData.customerId)
          : undefined;
        const linkedCustomerByCf = linkedCustomerById ? null : findCustomerByCf(contractData.cf);
        const linkedCustomer = linkedCustomerById || linkedCustomerByCf;

        if (linkedCustomer) {
          linkedCustomer.purchases.push(contractWithVehicle);
          return;
        }
      });

      customerMap.forEach(customer => {
        const computedTotalSpent = customer.purchases.reduce((sum, purchase) => {
          const salePrice = Number(purchase.vehicleSalePrice ?? purchase.price ?? 0);
          return sum + (Number.isFinite(salePrice) ? salePrice : 0);
        }, 0);

        customer.totalPurchases = customer.purchases.length;
        customer.totalSpent = computedTotalSpent;
      });

      const customersData = Array.from(customerMap.values()).sort((a, b) => {
        const left = typeof a.name === 'string' ? a.name : '';
        const right = typeof b.name === 'string' ? b.name : '';
        return left.localeCompare(right, 'it');
      });

      setCustomers(customersData);
    } catch (error: any) {
      console.error('Errore caricamento clienti:', error);
      toast({
        variant: 'destructive',
        title: 'Errore caricamento',
        description:
          error?.code === 'permission-denied'
            ? 'Permessi insufficienti per leggere i clienti. Verifica il ruolo utente.'
            : 'Non riesco a caricare i clienti.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.cf.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.phone?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [customers, searchTerm]);

  const handleDetailCustomerSave = async () => {
    if (!firestore || !selectedCustomer) return;

    if (isLegacyCustomer(selectedCustomer.id)) {
      toast({
        variant: 'destructive',
        title: 'Cliente non modificabile',
        description: 'Questo cliente è stato generato da un contratto legacy e va aggiornato dal contratto.',
      });
      return;
    }

    setIsSavingCustomer(true);
    try {
      await setDoc(
        doc(firestore, 'customers', selectedCustomer.id),
        {
          name: selectedCustomer.name,
          address: selectedCustomer.address,
          cf: selectedCustomer.cf,
          customerType: selectedCustomer.customerType,
          docNumber: selectedCustomer.docNumber || null,
          birthDate: selectedCustomer.birthDate || null,
          birthPlace: selectedCustomer.birthPlace || null,
          phone: selectedCustomer.phone || null,
          email: selectedCustomer.email || null,
          // Mantengo createdBy per compatibilità regole correnti.
          createdBy: selectedCustomer.createdBy,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast({
        title: 'Cliente aggiornato',
        description: 'Le modifiche sono state salvate correttamente.',
      });
      await loadCustomers();
    } catch (error: any) {
      console.error('Errore aggiornamento cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Salvataggio fallito',
        description:
          error?.code === 'permission-denied'
            ? 'Permessi insufficienti per modificare il cliente.'
            : 'Impossibile aggiornare il cliente.',
      });
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!firestore) return;
    if (isLegacyCustomer(customer.id)) {
      toast({
        variant: 'destructive',
        title: 'Cliente non eliminabile',
        description: 'Questa voce deriva da contratto legacy e non esiste come anagrafica clienti.',
      });
      return;
    }

    const confirmed = window.confirm(`Confermi eliminazione cliente "${customer.name}"?`);
    if (!confirmed) return;

    setDeletingCustomerId(customer.id);
    try {
      await deleteDoc(doc(firestore, 'customers', customer.id));
      toast({
        title: 'Cliente eliminato',
        description: 'Il cliente è stato rimosso dalla rubrica. I contratti storici restano archiviati.',
      });
      await loadCustomers();
    } catch (error: any) {
      console.error('Errore eliminazione cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Eliminazione fallita',
        description:
          error?.code === 'permission-denied'
            ? 'Permessi insufficienti per eliminare il cliente.'
            : 'Impossibile eliminare il cliente.',
      });
    } finally {
      setDeletingCustomerId(null);
    }
  };

  const handleCreateCustomer = async () => {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Utente non disponibile',
        description: 'Effettua il login prima di creare un cliente.',
      });
      return;
    }

    const name = (newCustomer.name || '').trim();
    const cf = (newCustomer.cf || '').trim();
    const address = (newCustomer.address || '').trim();

    if (!name || !cf || !address) {
      toast({
        variant: 'destructive',
        title: 'Dati mancanti',
        description: 'Compila almeno Nome, CF/P.IVA e Indirizzo.',
      });
      return;
    }

    setIsCreatingCustomer(true);
    try {
      const customerRef = doc(collection(firestore, 'customers'));
      await setDoc(customerRef, {
        id: customerRef.id,
        adminOnly: false,
        name,
        customerType: newCustomer.customerType || 'privato',
        cf,
        address,
        email: (newCustomer.email || '').trim() || null,
        phone: (newCustomer.phone || '').trim() || null,
        docNumber: (newCustomer.docNumber || '').trim() || null,
        birthDate: (newCustomer.birthDate || '').trim() || null,
        birthPlace: (newCustomer.birthPlace || '').trim() || null,
        totalPurchases: 0,
        totalSpent: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid,
      });

      toast({
        title: 'Cliente creato',
        description: 'Anagrafica cliente salvata correttamente.',
      });

      setIsCreateDialogOpen(false);
      setNewCustomer({
        name: '',
        customerType: 'privato',
        cf: '',
        address: '',
        email: '',
        phone: '',
        docNumber: '',
        birthDate: '',
        birthPlace: '',
      });

      await loadCustomers();
    } catch (error: any) {
      console.error('Errore creazione cliente:', error);
      toast({
        variant: 'destructive',
        title: 'Creazione fallita',
        description:
          error?.code === 'permission-denied'
            ? 'Permessi insufficienti per creare il cliente.'
            : 'Impossibile creare il cliente.',
      });
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  const handleDeleteContract = async (contractId: string, customerName: string) => {
    if (!firestore) return;

    const confirmed = window.confirm(
      `Confermi eliminazione del contratto? Questa azione rimuove il contratto dalla Gestione Clienti per ${customerName}.`
    );
    if (!confirmed) return;

    setDeletingContractId(contractId);
    try {
      await deleteDoc(doc(firestore, 'contracts', contractId));

      toast({
        title: 'Contratto eliminato',
        description: 'Il contratto è stato rimosso correttamente.',
      });

      await loadCustomers();

      setSelectedCustomer(current => {
        if (!current) return current;
        return {
          ...current,
          purchases: current.purchases.filter(purchase => purchase.id !== contractId),
        };
      });
    } catch (error: any) {
      console.error('Errore eliminazione contratto:', error);
      toast({
        variant: 'destructive',
        title: 'Eliminazione contratto fallita',
        description:
          error?.code === 'permission-denied'
            ? 'Permessi insufficienti per eliminare il contratto.'
            : 'Impossibile eliminare il contratto.',
      });
    } finally {
      setDeletingContractId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Gestione Clienti</h1>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestione Clienti</h1>
            <p className="mt-2 text-slate-600">
              Visualizza i dati anagrafici dei clienti e i veicoli acquistati.
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>Nuovo cliente</Button>
        </div>

        {/* Search Bar */}
        <div className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Cerca per nome, email, CF o telefono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={loadCustomers} variant="outline">
            <Loader2 className="mr-2 h-4 w-4" />
            Aggiorna
          </Button>
        </div>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Clienti ({filteredCustomers.length})</CardTitle>
            <CardDescription>
              Elenco dei clienti registrati nel sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-slate-600">
                  {searchTerm ? 'Nessun cliente trovato.' : 'Nessun cliente registrato.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo Cliente</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Acquisti</TableHead>
                      <TableHead>Totale Speso</TableHead>
                      <TableHead>Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <button
                            type="button"
                            className="font-semibold text-left hover:underline"
                            onClick={() => {
                              setSelectedCustomer({ ...customer, purchases: [...customer.purchases] });
                              setIsDetailDialogOpen(true);
                            }}
                          >
                            {customer.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant={customer.customerType === 'privato' ? 'outline' : 'secondary'}>
                            {customer.customerType === 'privato' ? 'Privato' : 'Commerciante'}
                          </Badge>
                        </TableCell>
                        <TableCell>{customer.email || '-'}</TableCell>
                        <TableCell>{customer.phone || '-'}</TableCell>
                        <TableCell className="text-center">{customer.purchases.length}</TableCell>
                        <TableCell className="font-semibold">
                          €{(customer.totalSpent || 0).toLocaleString('it-IT')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCustomer({ ...customer, purchases: [...customer.purchases] });
                                setIsDetailDialogOpen(true);
                              }}
                            >
                              Dettagli
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCustomer(customer)}
                              disabled={isLegacyCustomer(customer.id) || deletingCustomerId === customer.id}
                              title={isLegacyCustomer(customer.id) ? 'Cliente legacy non eliminabile' : 'Elimina cliente'}
                            >
                              {deletingCustomerId === customer.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Dettagli Cliente - {selectedCustomer?.name}</DialogTitle>
            </DialogHeader>
            
            {selectedCustomer && (
              <div className="space-y-6">
                {/* Dati Anagrafici */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Dati Anagrafici</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      placeholder="Nome / Ragione sociale"
                      value={selectedCustomer.name}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, name: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <select
                      className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedCustomer.customerType}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current
                            ? { ...current, customerType: e.target.value as Customer['customerType'] }
                            : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    >
                      <option value="privato">Privato</option>
                      <option value="commerciante">Commerciante</option>
                    </select>
                    <Input
                      placeholder="Codice Fiscale / P.IVA"
                      value={selectedCustomer.cf}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, cf: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <Input
                      placeholder="Numero documento"
                      value={selectedCustomer.docNumber || ''}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, docNumber: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <Input
                      type="date"
                      value={selectedCustomer.birthDate || ''}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, birthDate: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <Input
                      placeholder="Luogo di nascita"
                      value={selectedCustomer.birthPlace || ''}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, birthPlace: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <Input
                      className="sm:col-span-2"
                      placeholder="Indirizzo"
                      value={selectedCustomer.address}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, address: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <Input
                      placeholder="Email"
                      value={selectedCustomer.email || ''}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, email: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <Input
                      placeholder="Telefono"
                      value={selectedCustomer.phone || ''}
                      onChange={e =>
                        setSelectedCustomer(current =>
                          current ? { ...current, phone: e.target.value } : current
                        )
                      }
                      disabled={isLegacyCustomer(selectedCustomer.id)}
                    />
                    <div className="sm:col-span-2 flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                        Chiudi
                      </Button>
                      <Button
                        onClick={handleDetailCustomerSave}
                        disabled={isSavingCustomer || isLegacyCustomer(selectedCustomer.id)}
                      >
                        {isSavingCustomer ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvataggio...
                          </>
                        ) : (
                          'Salva Cliente'
                        )}
                      </Button>
                    </div>
                  </div>
                  {isLegacyCustomer(selectedCustomer.id) && (
                    <p className="mt-3 text-sm text-amber-700">
                      Cliente legacy: modifica bloccata. Aggiorna i dati direttamente dal contratto collegato.
                    </p>
                  )}
                </div>

                {/* Acquisti */}
                {selectedCustomer.purchases.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Veicoli Acquistati ({selectedCustomer.purchases.length})</h3>
                    <div className="space-y-4">
                      {selectedCustomer.purchases.map((purchase, idx) => (
                        <Card key={idx} className="bg-slate-50">
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-slate-600">Veicolo</p>
                                <p className="font-medium">
                                  {purchase.vehicle ? `${purchase.vehicle.marca} ${purchase.vehicle.modello} ${purchase.vehicle.versione}` : 'N/D'}
                                </p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-600">Targa</p>
                                <p className="font-medium">{purchase.vehicle?.targa || 'N/D'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-600">Prezzo Vendita</p>
                                <p className="font-medium">€{(purchase.vehicleSalePrice || 0).toLocaleString('it-IT')}</p>
                              </div>
                              <div>
                                <p className="text-sm text-slate-600">Metodo Pagamento</p>
                                <p className="font-medium">{purchase.paymentMethod === 'finanziamento' ? `Finanziamento (${purchase.numberOfInstallments} rate)` : purchase.paymentMethod}</p>
                              </div>
                              <div className="col-span-2 space-y-2">
                                {purchase.signedContractUrl && (
                                  <div>
                                    <p className="text-sm text-slate-600 mb-2">Contratto Firmato</p>
                                    <Button size="sm" variant="outline" asChild>
                                      <a href={purchase.signedContractUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="mr-2 h-4 w-4" />
                                        Scarica Contratto
                                      </a>
                                    </Button>
                                  </div>
                                )}
                                {purchase.vehicle?.slug || purchase.vehicleId ? (
                                  <Button size="sm" variant="outline" asChild>
                                    <Link
                                      href={`/auto/${purchase.vehicle?.slug || purchase.vehicleId}/contratto?returnTo=/admin/customers`}
                                    >
                                      <Pencil className="mr-2 h-4 w-4" />
                                      Modifica Contratto
                                    </Link>
                                  </Button>
                                ) : null}
                                {purchase.id ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteContract(purchase.id, selectedCustomer.name)}
                                    disabled={deletingContractId === purchase.id}
                                  >
                                    {deletingContractId === purchase.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-2 h-4 w-4" />
                                    )}
                                    Elimina Contratto
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nuovo Cliente</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                placeholder="Nome / Ragione sociale *"
                value={newCustomer.name || ''}
                onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
              <Input
                placeholder="Codice Fiscale / P.IVA *"
                value={newCustomer.cf || ''}
                onChange={e => setNewCustomer({ ...newCustomer, cf: e.target.value })}
              />
              <Input
                className="sm:col-span-2"
                placeholder="Indirizzo *"
                value={newCustomer.address || ''}
                onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
              />
              <Input
                placeholder="Email"
                value={newCustomer.email || ''}
                onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
              />
              <Input
                placeholder="Telefono"
                value={newCustomer.phone || ''}
                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
              <Input
                placeholder="Numero documento"
                value={newCustomer.docNumber || ''}
                onChange={e => setNewCustomer({ ...newCustomer, docNumber: e.target.value })}
              />
              <Input
                placeholder="Luogo di nascita"
                value={newCustomer.birthPlace || ''}
                onChange={e => setNewCustomer({ ...newCustomer, birthPlace: e.target.value })}
              />
              <Input
                type="date"
                value={newCustomer.birthDate || ''}
                onChange={e => setNewCustomer({ ...newCustomer, birthDate: e.target.value })}
              />
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateCustomer} disabled={isCreatingCustomer}>
                  {isCreatingCustomer ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creazione...
                    </>
                  ) : (
                    'Crea cliente'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
