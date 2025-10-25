# ChangeOrderino Frontend

React 18 + TypeScript SPA for construction change order management.

## Tech Stack

- **React 18.3** - UI framework
- **TypeScript 5.2** - Type safety
- **Vite 4.5** - Build tool & dev server
- **React Router 7.0** - Client-side routing
- **Redux Toolkit 2.0** - Global state
- **React Query 5.8** - Server state & caching
- **Tailwind CSS 3.4** - Utility-first CSS
- **Keycloak.js 26.0** - SSO integration

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Development

The app will be available at http://localhost:3000

The Vite dev server proxies `/api` requests to the backend API service.

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `VITE_API_URL` - API endpoint (default: `/api`)
- `VITE_KEYCLOAK_URL` - Keycloak server URL
- `VITE_KEYCLOAK_REALM` - Keycloak realm name
- `VITE_KEYCLOAK_CLIENT_ID` - Keycloak client ID
- `VITE_AUTH_ENABLED` - Enable/disable authentication

## Project Structure

```
src/
├── api/              # API client & endpoints
├── components/       # React components
│   ├── common/       # Reusable UI components
│   ├── layout/       # Layout components
│   ├── projects/     # Project components
│   ├── tnm/          # TNM ticket components
│   └── approval/     # Approval components
├── hooks/            # Custom React hooks
├── pages/            # Page components
├── store/            # Redux store & slices
├── types/            # TypeScript types
├── utils/            # Utility functions
├── styles/           # Global CSS
├── App.tsx           # Main App component
└── main.tsx          # Entry point
```

## Features

- ✅ Keycloak SSO authentication
- ✅ Responsive design (desktop & iPad)
- ✅ Real-time form validation
- ✅ Optimistic updates
- ✅ Loading states & error handling
- ✅ Toast notifications
- ✅ Type-safe API calls

## Docker

Build and run with Docker:

```bash
docker build -t changeorderino-frontend .
docker run -p 80:80 changeorderino-frontend
```

## License

Proprietary
