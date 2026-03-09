'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUser, useFirestore, useFirebaseApp, useMemoFirebase } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { Form as FormType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { UploadCloud, FileText, Trash2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const formSchema = z.object({
  title: z.string().min(3, 'Il titolo è obbligatorio e deve avere almeno 3 caratteri.'),
  category: z.enum(['cliente', 'commerciante'], {
    required_error: 'La categoria è obbligatoria.',
  }),
  file: z.instanceof(File).refine(file => file.size > 0, 'Il file è obbligatorio.'),
});

type FormValues = z.infer<typeof formSchema>;

function FormList({ forms, isAdmin, onDelete }: { forms: FormType[], isAdmin: boolean, onDelete: (form: FormType) => void }) {
    if (!forms || forms.length === 0) {
        return <p className="text-muted-foreground mt-4">Nessun modulo in questa categoria.</p>
    }
    return (
        <div className="space-y-3 mt-4">
            {forms.map((form) => (
                <Card key={form.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                        <FileText className="h-6 w-6 text-primary" />
                        <Link href={form.fileUrl} target="_blank" className="font-medium hover:underline">
                            {form.title}
                        </Link>
                    </div>
                    {isAdmin && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Questa azione non può essere annullata. Eliminerà permanentemente il modulo.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(form)}>Conferma</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </Card>
            ))}
        </div>
    );
}


export default function ModulisticaPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const storage = useMemo(() => getStorage(app), [app]);
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const formsRef = useMemoFirebase(() => collection(firestore, 'forms'), [firestore]);
  const { data: forms, isLoading: isLoadingForms } = useCollection<FormType>(formsRef);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        title: '',
        category: undefined,
        file: undefined
    }
  });

  useEffect(() => {
    if (user && firestore) {
      setIsLoadingRole(true);
      const checkAdmin = async () => {
        const adminRef = doc(firestore, 'roles_admin', user.uid);
        const adminDoc = await getDoc(adminRef);
        setIsAdmin(adminDoc.exists());
        setIsLoadingRole(false);
      };
      checkAdmin();
    } else {
      setIsAdmin(false);
      setIsLoadingRole(false);
    }
  }, [user, firestore]);

  const { clientForms, merchantForms } = useMemo(() => {
    const clientForms: FormType[] = [];
    const merchantForms: FormType[] = [];
    forms?.forEach(form => {
      if (form.category === 'cliente') {
        clientForms.push(form);
      } else if (form.category === 'commerciante') {
        merchantForms.push(form);
      }
    });
    return { clientForms, merchantForms };
  }, [forms]);

  const handleDelete = async (formToDelete: FormType) => {
    if (!firestore || !storage) return;

    toast({ title: 'Eliminazione in corso...' });

    try {
      // Delete file from Storage
      const fileRef = ref(storage, `forms/${formToDelete.id}/${formToDelete.fileName}`);
      await deleteObject(fileRef);

      // Delete document from Firestore
      const docRef = doc(firestore, 'forms', formToDelete.id);
      await deleteDocumentNonBlocking(docRef);

      toast({
        title: 'Modulo eliminato!',
        description: `"${formToDelete.title}" è stato rimosso.`,
      });
    } catch (error: any) {
        console.error("Errore durante l'eliminazione:", error);
        toast({
            variant: "destructive",
            title: "Uh oh! Qualcosa è andato storto.",
            description: "Impossibile eliminare il modulo.",
        });
    }
  };


  async function onSubmit(data: FormValues) {
    if (!firestore || !storage) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    const newDocRef = doc(collection(firestore, 'forms'));
    const storageRef = ref(storage, `forms/${newDocRef.id}/${data.file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, data.file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        toast({
            variant: "destructive",
            title: "Upload fallito",
            description: "Impossibile caricare il file.",
        });
        setIsSubmitting(false);
      },
      async () => {
        try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            const formData: Omit<FormType, 'id'> = {
                title: data.title,
                category: data.category,
                fileUrl: downloadURL,
                fileName: data.file.name,
                createdAt: serverTimestamp(),
            };

            await setDoc(newDocRef, formData);

            toast({
                title: "Modulo caricato!",
                description: `"${data.title}" è stato aggiunto con successo.`,
            });
            form.reset({ title: '', category: undefined, file: undefined });
        } catch (error) {
            console.error("Error saving document:", error);
            toast({
                variant: "destructive",
                title: "Salvataggio fallito",
                description: "Impossibile salvare i dati del modulo.",
            });
        } finally {
            setIsSubmitting(false);
        }
      }
    );
  }

  const isLoading = isLoadingForms || isLoadingRole;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Modulistica</h1>
      </div>

      {isAdmin && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Carica Nuovo Modulo</CardTitle>
            <CardDescription>
              Aggiungi un nuovo documento che sarà visibile a tutti gli utenti.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Titolo Modulo *</FormLabel>
                        <FormControl>
                            <Input placeholder="Es. Contratto di vendita" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Categoria *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona una categoria" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="cliente">Per il Cliente</SelectItem>
                            <SelectItem value="commerciante">Per il Commerciante</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>File *</FormLabel>
                      <FormControl>
                        <Input type="file" onChange={e => onChange(e.target.files?.[0])} {...rest} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isSubmitting && <Progress value={uploadProgress} className="w-full" />}

                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Caricamento...
                        </>
                    ) : (
                        <>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Carica Modulo
                        </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="cliente" className="w-full">
        <TabsList>
          <TabsTrigger value="cliente">Per il Cliente</TabsTrigger>
          <TabsTrigger value="commerciante">Per il Commerciante</TabsTrigger>
        </TabsList>
        <TabsContent value="cliente">
            {isLoading ? <Skeleton className="h-24 w-full" /> : <FormList forms={clientForms} isAdmin={isAdmin} onDelete={handleDelete} />}
        </TabsContent>
        <TabsContent value="commerciante">
            {isLoading ? <Skeleton className="h-24 w-full" /> : <FormList forms={merchantForms} isAdmin={isAdmin} onDelete={handleDelete} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
