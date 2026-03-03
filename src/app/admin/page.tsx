'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { seedDatabase } from '@/lib/api';
import { useState } from 'react';

export default function AdminPage() {
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleSeed = async () => {
        setIsLoading(true);
        try {
            const result = await seedDatabase();
            toast({
                title: "Database Seeded",
                description: result.message,
            });
        } catch (error: any) {
            toast({
                variant: "destructive",
                title: "Error Seeding Database",
                description: error.message || "An unknown error occurred",
            });
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Pannello di Amministrazione</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gestione Database</CardTitle>
          <CardDescription>Azioni per popolare e gestire il database.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleSeed} disabled={isLoading}>
                {isLoading ? "Popolamento in corso..." : "Popola il database con dati di esempio"}
            </Button>
            <p className="text-sm text-muted-foreground">
                Questa azione aggiungerà i veicoli di esempio a Firestore.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
