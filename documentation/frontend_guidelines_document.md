# Frontend Guidelines for Naitive Engage Suite

This document outlines the frontend architecture, design principles, styling, component structure, state management, routing, performance strategies, and testing approach for the Naitive Engage Suite. It is written in everyday language so that anyone—from designers to developers—can understand how the frontend is set up, why certain choices were made, and how to maintain or extend the application.

## 1. Frontend Architecture

### Overview
- **Framework**: Next.js (App Router) enables file-based routing, server-side rendering (SSR), and static site generation (SSG).
- **Library**: React for building user interfaces with reusable components.
- **Language**: TypeScript for type safety and better tooling.

### How It Supports Scalability, Maintainability & Performance
- **Scalable**: The App Router organizes pages, layouts, and API routes by folder. New features can be dropped into their own folders without touching existing code.
- **Maintainable**: TypeScript catches errors at compile time. Clear separation of features (auth, dashboard, sign-in, sign-up) keeps concerns isolated.
- **Performant**: Server components render UI on the server when appropriate, shrinking JavaScript bundles sent to the client.

## 2. Design Principles

### Key Principles
1. **Usability**: Interfaces are intuitive; forms guide the user with clear labels, placeholders, and error messages.
2. **Accessibility**: Follow WCAG guidelines—semantic HTML, ARIA attributes where needed, proper color contrast.
3. **Responsiveness**: Layouts adapt to mobile, tablet, and desktop. Touch targets remain large enough on small screens.
4. **Consistency**: Reuse components and styles across similar UI patterns to reduce cognitive load.

### Applying These Principles
- **Forms**: Each input has a label and helper text. Error messages appear inline.
- **Navigation**: Main nav elements are keyboard-accessible, with focus states clearly visible.
- **Layout**: Fluid grids and flexbox make sure content stacks or shrinks gracefully on narrow viewports.

## 3. Styling and Theming

### Styling Approach
- **CSS Modules**: Scoped CSS files (`*.module.css`) prevent naming collisions and make it easy to see which styles belong to which component.
- **Global Styles**: `globals.css` for base typography, resets, and utility classes (spacing, display shortcuts).
- **Feature Styles**: `theme.css` in the dashboard folder applies dashboard-specific overrides.

### Theming
- A central theme file defines colors, fonts, and elevation (shadows).
- Components reference CSS variables (e.g., `var(--color-primary)`) to ensure a consistent look.
- Future dark/light mode can be toggled by updating the `data-theme` attribute on the `<html>` element.

### Visual Style
- **Style**: Modern flat design with subtle shadows and rounded corners for a polished, approachable look.
- **Glassmorphism Elements**: Lightly frosted backgrounds for modals or overlays to direct user attention without losing context.

### Color Palette
- Primary Blue: #1E88E5  
- Secondary Teal: #009688  
- Accent Yellow: #FBC02D  
- Neutral Light: #F5F5F5  
- Neutral Dark: #212121  
- Error Red: #E53935  
- Success Green: #43A047  

### Typography
- **Font Family**: Inter, sans-serif (system fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI'`).
- **Headings**: 600 weight, scalable sizes (H1–H4).
- **Body**: 400 weight, 16px base, 1.5 line-height for readability.

## 4. Component Structure

### Organization
- **Feature Folders**: Each feature (sign-in, sign-up, dashboard, auth API) lives in its own folder under `/app`.
- **Layout Components**: `layout.tsx` files define shared UI (e.g., headers, footers, sidebars) for their scope.
- **Page Components**: `page.tsx` files handle data fetching and render content.
- **Shared Components**: A `/components` folder houses buttons, inputs, cards, and other reusable UI pieces.

### Benefits of Component-Based Architecture
- **Reusability**: Shared components reduce duplication.
- **Isolation**: Bugs in one component rarely affect others.
- **Testability**: Small, focused components are easier to write unit tests for.

## 5. State Management

### Approach
- **Authentication State**: Managed with React Context—provides user info and login/logout functions to any component.
- **Server Data**: Use React Query or SWR for fetching, caching, and syncing data from API routes.
- **Local UI State**: Simple `useState` or `useReducer` hooks inside components for uncontested state (e.g., form inputs, modals).

### Sharing State Across Components
- Wrap the application in an `<AuthProvider>` to give all pages access to `user`, `signIn()`, and `signOut()`.
- Use query keys in React Query to share and refresh engagement data across dashboard widgets automatically.

## 6. Routing and Navigation

### Routing
- **Next.js App Router**: File-based routing—each folder under `/app` with a `page.tsx` file becomes a route.
- **API Routes**: Files under `/app/api` handle POST/GET requests (e.g., `/api/auth/route.ts`).

### Navigation Structure
- **Public Routes**: `/sign-in`, `/sign-up` for unauthenticated users.
- **Protected Routes**: `/dashboard` behind authentication checks—redirect to `/sign-in` if no valid session.
- **Client-Side Transitions**: Use Next.js `Link` component for fast, pre-loaded navigation.

## 7. Performance Optimization

### Strategies
1. **Lazy Loading**: Dynamically import non-critical components (e.g., chart libraries) so they load only when needed.  
2. **Code Splitting**: Next.js splits code by route automatically; ensure large modules aren’t imported in the global scope.  
3. **Image Optimization**: Use Next.js `<Image>` component to serve scaled and optimized images.  
4. **Asset Compression**: Enable Brotli/Gzip compression on the server.  
5. **Caching**: Leverage SSR/SSG for static content and React Query’s cache for data.

### User Experience Impact
- Users see the page shell almost instantly (SSR), then hydration and data updates happen in the background.
- Charts and heavy widgets load only when the user navigates to the dashboard, keeping initial download small.

## 8. Testing and Quality Assurance

### Testing Strategies
1. **Unit Tests**: Jest + React Testing Library for individual components (buttons, forms, utilities).  
2. **Integration Tests**: Test authentication flow and dashboard data fetching by mocking API routes.  
3. **End-to-End (E2E) Tests**: Cypress to simulate real user interactions (sign-in → navigate to dashboard → interact with widgets).

### Tools and Frameworks
- **Jest** for fast unit tests.  
- **React Testing Library** for DOM-based component assertions.  
- **Cypress** for browser-level E2E tests.  
- **ESLint** and **Prettier** for code style and linting.  
- **TS-Node** or similar scripts to run type checks before merges.

## 9. Conclusion and Overall Frontend Summary

Naitive Engage Suite’s frontend is built on modern tools—Next.js, React, TypeScript—to ensure a scalable, maintainable, and high-performance application. By following clear design principles (usability, accessibility, responsiveness), a modular component structure, and robust testing strategies, the team can confidently deliver new features and maintain a consistent user experience. The chosen styling approach (flat design with subtle glassmorphism accents) and a well-defined color palette create a cohesive look, while state management and routing conventions ensure developer productivity and smooth navigation. Together, these guidelines serve as a blueprint for anyone joining the project or extending its functionality.

---

Feel free to refer back to this document as the single source of truth for frontend decisions. It captures not only what we’re doing today but also the reasoning behind our choices, making it easier to grow and adapt the Naitive Engage Suite in the future.