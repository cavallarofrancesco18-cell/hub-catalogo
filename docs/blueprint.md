# **App Name**: LuxDrive Catalog

## Core Features:

- Vehicle Listing Grid: Display a responsive grid of car cards on the '/auto' page, featuring cover image, brand, model, year, mileage, fuel, transmission, highlighted price, and a 'Vedi Dettagli' button.
- Dynamic Vehicle Detail Pages: Generate unique detail pages '/auto/[id]' for each vehicle, including a comprehensive image gallery, full technical data, commercial description, and an announcement status badge ('Pubblicato', 'Opzionato', 'Venduto').
- Advanced Filtering and Sorting: Implement filters for 'Marca', 'Prezzo min/max', 'Carburante', 'Cambio' and sorting options by price and year, interacting with Firestore data.
- External Photo Gallery Access: A 'Guarda tutte le foto' button on the detail page that opens a specific external Canva link for the vehicle, retrieved from the database.
- Direct WhatsApp Contact: A 'Contatta il consulente' WhatsApp button on the detail page that generates a pre-filled message to the assigned consultant using details from the database; this button is disabled if the vehicle's status is 'Venduto'.
- AI-assisted Commercial Description Tool: Provide a tool to assist in generating compelling commercial descriptions for each vehicle, utilizing its technical specifications to highlight key selling points and engaging potential buyers.
- SEO Optimized Vehicle Pages: Automatically generate SEO-friendly slugs (e.g., 'marca-modello-anno-id') and meta-tags for each dynamic vehicle detail page to improve search engine visibility.

## Style Guidelines:

- Primary color: Deep, sophisticated charcoal (#313133) for text and core UI elements, conveying a premium and professional automotive feel.
- Background color: A very light, subtle grey with a hint of blue (#F7F7FA) for a clean, modern, and elegant base.
- Accent color: A strong, professional medium blue (#4E89CC) for interactive elements like buttons and highlights, providing clear contrast and energy.
- Body and headline font: 'Inter' (sans-serif) for its modern, clean, and highly legible appearance, suitable for both large headlines and detailed car information.
- Utilize sleek, modern line-art icons that maintain a professional and minimalist aesthetic throughout the application, consistent with the automotive theme.
- Implement a professional, minimal, and modern layout, designed mobile-first. Employ card-based elements for vehicles, featuring subtle, light shadows to create an elegant sense of depth without distraction.
- Incorporate subtle, smooth transition animations for page navigation, element loading, and interactive hover effects on car cards and buttons to enhance user experience without being obtrusive.