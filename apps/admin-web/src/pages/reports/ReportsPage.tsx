import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionRelatedLinks } from '@/components/layout/SectionRelatedLinks';
import { REPORT_HUB_LINKS } from '@/data/financial-reports';
import { ACCOUNTING_SECTION_LINKS } from '@/data/section-links';
import './ReportsPage.css';

/**
 * Reports hub — links to working financial reports only.
 */
export function ReportsPage() {
  return (
    <div className="ga-rp-page">
      <PageHeader
        title="Reports"
        subtitle="Owner financial and business reports"
      />

      <SectionRelatedLinks
        label="Accounting"
        links={[...ACCOUNTING_SECTION_LINKS]}
      />

      <div className="ga-rp-hub">
        {REPORT_HUB_LINKS.map((item) => (
          <Link key={item.to} to={item.to} className="ga-rp-hub__card">
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
