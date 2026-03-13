import React from 'react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication check removed to allow for rebuilding the authentication flow.
  return <>{children}</>;
}
