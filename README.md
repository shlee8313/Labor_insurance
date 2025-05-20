This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

`

```

```

```
construction_labor_system
├─ .eslintrc.json
├─ app
│  ├─ api
│  │  ├─ code-masters
│  │  │  └─ route.js
│  │  └─ insurance-enrollments
│  │     └─ route.js
│  ├─ dashboard
│  │  ├─ company
│  │  │  ├─ edit
│  │  │  │  └─ [id]
│  │  │  │     └─ page.js
│  │  │  ├─ page.js
│  │  │  └─ register
│  │  │     └─ page.js
│  │  ├─ insurance
│  │  │  ├─ daily-work-report
│  │  │  │  └─ page.js
│  │  │  └─ insurance-enrollments
│  │  │     └─ page.js
│  │  ├─ layout.js
│  │  ├─ page.js
│  │  ├─ profile
│  │  │  └─ page.js
│  │  ├─ reports
│  │  │  ├─ dailyWorkerDetailConfirm
│  │  │  │  └─ page.js
│  │  │  ├─ dailyWorkerGongdan
│  │  │  │  └─ page.js
│  │  │  ├─ dailyWorkerHomeTax
│  │  │  │  └─ page.js
│  │  │  ├─ insuranceEligibilityLoss
│  │  │  │  └─ page.js
│  │  │  ├─ insuranceEligibilityRegistration
│  │  │  │  └─ page.js
│  │  │  ├─ page.js
│  │  │  └─ workersCompensationInsuranceReport
│  │  │     └─ page.js
│  │  ├─ settings
│  │  │  └─ page.js
│  │  ├─ sites
│  │  │  ├─ add
│  │  │  │  └─ page.js
│  │  │  ├─ edit
│  │  │  │  └─ [id]
│  │  │  │     └─ page.js
│  │  │  └─ page.js
│  │  ├─ taxInsuranceRates
│  │  │  └─ page.js
│  │  ├─ users
│  │  │  ├─ add
│  │  │  │  └─ page.js
│  │  │  ├─ edit
│  │  │  │  └─ [id]
│  │  │  │     └─ page.js
│  │  │  └─ page.js
│  │  ├─ workers
│  │  │  ├─ add
│  │  │  │  └─ page.js
│  │  │  ├─ edit
│  │  │  │  └─ [id]
│  │  │  │     └─ page.js
│  │  │  └─ page.js
│  │  └─ work_time
│  │     ├─ components
│  │     │  ├─ CalendarWorkTime.js
│  │     │  └─ WorkerAddModal.js
│  │     └─ page.js
│  ├─ favicon.ico
│  ├─ globals.css
│  ├─ layout.js
│  ├─ login
│  │  └─ page.js
│  ├─ page.js
│  └─ register
│     ├─ company
│     │  └─ page.js
│     └─ user
│        └─ page.js
├─ components
│  ├─ Header.js
│  ├─ RoleGuard.js
│  └─ Sidebar.js
├─ jsconfig.json
├─ lib
│  ├─ permissions.js
│  ├─ store
│  │  ├─ authStore.js
│  │  ├─ codeStore.js
│  │  ├─ useInsuranceStore.js
│  │  └─ workTimeStore.js
│  ├─ supabase.js
│  └─ utils
│     ├─ formattingUtils.js
│     ├─ insuranceCalculations.js
│     ├─ systemSettings.js
│     └─ taxCalculations.js
├─ middleware.js
├─ next.config.js
├─ package-lock.json
├─ package.json
├─ postcss.config.js
├─ public
│  ├─ next.svg
│  └─ vercel.svg
├─ README.md
└─ tailwind.config.js

```