export type Vehicle = {
  id: string;
  marca: string;
  modello: string;
  versione: string;
  anno: number;
  chilometraggio: number;
  carburante: 'Benzina' | 'Diesel' | 'Elettrica' | 'Ibrida';
  cambio: 'Manuale' | 'Automatico';
  potenza: number;
  colore_esterno: string;
  prezzo: number;
  descrizione: string;
  immagini: string[];
  link_canva: string;
  stato: 'Pubblicato' | 'Opzionato' | 'Venduto';
  consulente: string;
  telefono_consulente: string;
};
