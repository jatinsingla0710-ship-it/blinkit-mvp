import type { ReportsSection } from '@/data/reports-types';
import { ReportCard } from '@/components/reports/ReportCard';
import './ReportsSectionGrid.css';

type Props = {
  section: ReportsSection;
};

export function ReportsSectionGrid({ section }: Props) {
  return (
    <div className="ga-rp-section">
      <p className="ga-rp-section__intro">{section.intro}</p>
      <div className="ga-rp-section__grid">
        {section.reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  );
}
