import React from 'react';
import { LegalCenterPage, LegalPageProps } from './LegalCenterPage';

export const PrivacyPage: React.FC<LegalPageProps> = (props) => {
  return <LegalCenterPage {...props} initialTab="privacy" />;
};

export default PrivacyPage;
