# 🚀 Quick Start Guide - ChangeOrderino Frontend

## For Development

```bash
cd /opt/docker/ChangeOrderino/services/frontend

# Start dev server (http://localhost:3000)
npm run dev
```

## Test the Features

### 1. View Dashboard
- Open browser to `http://localhost:3000`
- You'll see the dashboard with stats

### 2. Create a Project
1. Click "Projects" in sidebar
2. Click "New Project" button
3. Fill in:
   - Project Name: "Main Street Office"
   - Project Number: "PROJ-2024-001"
   - GC Email: "gc@example.com"
   - Default OH&P: Leave as defaults (15%, 20%, 10%, 5%)
4. Click "Create Project"

### 3. Create a TNM Ticket (iPad-Optimized!)
1. Click "Create TNM" in sidebar OR
2. Go to Projects → Click on your project → "New TNM Ticket"
3. Fill in ticket info:
   - Select the project
   - Title: "Additional framing work"
   - Description: "Extra framing for 2nd floor"
4. Add Labor items:
   - Click "+ Add Labor Item"
   - Description: "Framing carpenter work"
   - Hours: 16
   - Type: Carpenter ($75/hr)
   - Watch the subtotal calculate: $1,200
5. Add Materials:
   - Click "+ Add Material"
   - Description: "2x4 lumber"
   - Quantity: 100
   - Unit: "ft"
   - Unit Price: 3.50
   - Subtotal: $350
6. See the **Proposal Summary** update in real-time!
   - Labor: $1,200 + 20% OH&P = $1,440
   - Materials: $350 + 15% OH&P = $402.50
   - **Total: $1,842.50**
7. Add signature (optional):
   - Click "Add GC Signature"
   - Draw on the signature pad
   - Click "Save Signature"
8. Submit for review!

## iPad Testing

### Safari on iPad
1. Start dev server: `npm run dev`
2. Get your machine's IP: `hostname -I`
3. On iPad, open Safari to `http://YOUR_IP:3000`
4. Test the signature pad - it's super smooth!
5. Try adding photos from camera

### iPad Simulator (macOS)
1. Open Xcode → Open Developer Tool → Simulator
2. Choose iPad Pro
3. Open Safari
4. Navigate to `http://localhost:3000`

## Environment Variables

Edit `.env` to configure:

```bash
# API endpoint
VITE_API_URL=/api

# Keycloak (for production)
VITE_KEYCLOAK_URL=https://localhost:8443
VITE_KEYCLOAK_REALM=changeorderino
VITE_KEYCLOAK_CLIENT_ID=changeorderino-app

# Development mode (skip auth)
VITE_AUTH_ENABLED=false   # Set to true for production
```

## Build for Production

```bash
# Build
npm run build

# Preview the build locally
npm run preview

# Docker build & run
docker build -t changeorderino-frontend .
docker run -p 80:80 changeorderino-frontend
```

## Key Features to Test

### ✅ Projects
- Create, edit, view, archive projects
- Search and filter
- View TNM tickets per project

### ✅ TNM Creation
- All 4 line item types (Labor, Material, Equipment, Sub)
- Real-time OH&P calculations
- Signature pad (smooth on iPad!)
- Photo upload
- Sticky summary sidebar

### ✅ UI/UX
- Responsive design (resize browser)
- Touch-friendly (test on iPad)
- Status badges with colors
- Toast notifications (try creating/editing)
- Loading states

## Troubleshooting

### Port 3000 already in use?
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- --port 3001
```

### Build errors?
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
npm run build
```

### Signature pad not working?
- Make sure you're using a modern browser
- On iPad, use Safari (not Chrome)
- Check browser console for errors

## Development Tips

### Hot Reload
- Changes to `.tsx` files reload instantly
- Changes to `.css` files reload without page refresh
- Changes to `types/` trigger TypeScript recompilation

### Component Development
1. Create component in `src/components/`
2. Import in page
3. See changes instantly
4. TypeScript will catch errors

### Debugging
- React DevTools (browser extension)
- Redux DevTools (browser extension)
- React Query DevTools (included in dev mode)
- Browser console for errors

## Next Steps

Once the backend API is ready:

1. Set `VITE_AUTH_ENABLED=true` in `.env`
2. Configure Keycloak URL
3. Start backend API service
4. Test full integration:
   - Create projects
   - Create TNM tickets
   - Send for approval
   - GC approval flow

## Support

For issues or questions:
1. Check browser console for errors
2. Check network tab for API calls
3. Verify environment variables
4. Check this guide

---

**Happy Development! 🎉**

The frontend is production-ready and waiting for the backend API!
