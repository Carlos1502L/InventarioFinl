import React from 'react';
import { LegalCenterPage, LegalPageProps } from './LegalCenterPage';

export const TermsPage: React.FC<LegalPageProps> = (props) => {
  return <LegalCenterPage {...props} initialTab="terms" />;
};

export default TermsPage;
