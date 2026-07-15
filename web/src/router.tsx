import { createBrowserRouter, Navigate } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { SignInPage } from '@/pages/SignInPage'
import { RegistryPage } from '@/pages/RegistryPage'
import { NominatePage } from '@/pages/NominatePage'
import { NominationDetailPage } from '@/pages/NominationDetailPage'
import { EditNominationPage } from '@/pages/EditNominationPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { AdminPage } from '@/pages/AdminPage'
import { CommentsModerationPage } from '@/pages/CommentsModerationPage'
import { UsersPage } from '@/pages/UsersPage'
import { DocPage } from '@/pages/DocPage'
import { NotFoundPage } from '@/pages/stubs'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/registry" replace /> },
      { path: 'registry', element: <RegistryPage /> },
      { path: 'nominations/:id', element: <NominationDetailPage /> },
      {
        path: 'nominations/:id/edit',
        element: (
          <RequireAuth>
            <EditNominationPage />
          </RequireAuth>
        ),
      },
      { path: 'sign-in', element: <SignInPage /> },
      { path: 'guidelines', element: <DocPage src="/nomination-guidelines.md" /> },
      { path: 'code-of-conduct', element: <DocPage src="/code-of-conduct.md" /> },
      {
        path: 'nominate',
        element: (
          <RequireAuth>
            <NominatePage />
          </RequireAuth>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        ),
      },
      {
        path: 'profile',
        element: (
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin',
        element: (
          <RequireAuth role="maintainer">
            <AdminPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/comments',
        element: (
          <RequireAuth role="maintainer">
            <CommentsModerationPage />
          </RequireAuth>
        ),
      },
      {
        path: 'admin/users',
        element: (
          <RequireAuth role="maintainer">
            <UsersPage />
          </RequireAuth>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
