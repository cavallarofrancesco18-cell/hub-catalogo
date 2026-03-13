import React from 'react';

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authentication check removed to allow for rebuilding the authentication flow.
  return <>{children}</>;
}
