# Kaydo

A private family photo-sharing platform — your digital living room. Share memories, photos, and stories with your inner circle.

## Features

- **Private Access**: Family and friends enter with a shared password — no account needed
- **Admin Dashboard**: Upload photos, create memories, manage the shared password
- **Daily Moments**: Story circles for quick daily snapshots
- **Memory Feed**: Rich memory cards with photos, stories, and quotes
- **Memory Detail**: Full-page view with hero image, blockquote, and narrative
- **Photo Albums**: Family album glimpse grid on the homepage
- **Responsive**: Desktop sidebar layout + mobile-first design

## Tech Stack

- **React + Vite** — Fast, modern frontend
- **Tailwind CSS** — Warm, cozy design system
- **Firebase Auth** — Admin authentication
- **Firebase Firestore** — Database for memories, moments, albums
- **Cloudinary** — Image storage and transformations

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your Firebase and Cloudinary credentials:
   ```bash
   cp .env.example .env.local
   ```

3. Set up Firebase:
   - Create a Firebase project at console.firebase.google.com
   - Enable Email/Password authentication
   - Create a Firestore database
   - Create an admin user in Firebase Auth
   - Deploy the Firestore security rules from `firestore.rules`

4. Set up Cloudinary:
   - Create an account at cloudinary.com
   - Create an unsigned upload preset in Settings > Upload

5. Set the shared password (first-time setup):
   - Log in as admin
   - Go to settings and set the shared password for family access

6. Start the dev server:
   ```bash
   npm run dev
   ```

## Access Model

- **Viewers** (family/friends): Enter the shared password to view all memories. Read-only access.
- **Admin**: Firebase email/password login. Can create, edit, delete memories, upload photos, and change the shared password.

## License

MIT
