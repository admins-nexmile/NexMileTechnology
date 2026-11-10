# NexMileTechnology

NexmileTechnology is a multi-technology IT services, software development, technology consulting, digital solutions, and professional training company.

**Technology That Takes Your Business Further. Innovate. Build. Transform.**

The official website for NexMile Technology, built with [Next.js](https://nextjs.org), React, TypeScript and Tailwind CSS.

## Tech Stack

- [Next.js 16](https://nextjs.org) (App Router)
- [React 19](https://react.dev)
- [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [ESLint](https://eslint.org)

## Prerequisites

- [Node.js](https://nodejs.org) 20 or later
- npm (included with Node.js)

## Getting Started

1. Clone the repository:

   ```bash
   git clone https://github.com/admins-nexmile/NexMileTechnology.git
   cd NexMileTechnology
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

Pages live in `src/app/`. Start with `src/app/page.tsx`. The site reloads automatically when you save changes.

## Available Scripts

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start the local development server       |
| `npm run build` | Create an optimized production build     |
| `npm run start` | Run the production build locally         |
| `npm run lint`  | Check the code with ESLint               |

## Project Structure

```
src/app/      Pages, layouts and global styles (App Router)
public/       Static assets such as images and icons
```

## Environment Variables

Keep any environment variables in a `.env.local` file in the project root. Never commit `.env` files: `.gitignore` already excludes them. Never put API keys, passwords or tokens in the code.

## Fonts

The site uses [`next/font`](https://nextjs.org/docs/app/getting-started/fonts) to load and optimize the [Geist](https://vercel.com/font) font family automatically.

## Deployment

The site can be deployed to any platform that supports Next.js, such as [Vercel](https://vercel.com). See the [Next.js deployment documentation](https://nextjs.org/docs/app/getting-started/deploying) for details.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
