import { useEffect, useState } from 'react';
import type { InvoicePrintSize, OrderDetail } from '@/data/orders-types';
import {
  defaultInvoiceFilename,
  invoiceDocumentDateLabel,
} from '@/data/order-helpers';
import { useRecordInvoicePrintedMutation } from '@/data/mutations';
import './OrderInvoicePrint.css';

type Props = {
  order: OrderDetail;
  autoOpenPreview?: boolean;
  onPreviewHandled?: () => void;
};

const SIZE_LABELS: Record<InvoicePrintSize, string> = {
  a4: 'A4',
  a5: 'A5',
  a6: 'A6',
  thermal: 'Thermal',
};

/**
 * Wholesale invoice — seller left / buyer right, multi-size print + browser save-as-PDF.
 * Does not generate or store a PDF file; "Save as PDF" uses the browser print dialog.
 */
export function OrderInvoicePrint({
  order,
  autoOpenPreview = false,
  onPreviewHandled,
}: Props) {
  const recordPrinted = useRecordInvoicePrintedMutation();
  const [printSize, setPrintSize] = useState<InvoicePrintSize>('a5');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [filename, setFilename] = useState(defaultInvoiceFilename(order));
  const converted = Boolean(order.sale);
  const hasInvoiceDoc = converted || Boolean(order.invoiceNumber);

  useEffect(() => {
    setFilename(defaultInvoiceFilename(order));
  }, [
    order.orderCode,
    order.customerName,
    order.invoiceNumber,
    order.sale?.invoiceNumber,
  ]);

  useEffect(() => {
    if (!autoOpenPreview) return;
    setPreviewOpen(true);
    onPreviewHandled?.();
  }, [autoOpenPreview, onPreviewHandled]);

  const company = order.company ?? {
    companyName: 'GroAurum',
    sellerName: 'GroAurum',
    email: '—',
    phoneLabel: '—',
    businessAddress: '—',
  };
  const shopName = order.shopName ?? order.customerName;
  const invoiceDate = invoiceDocumentDateLabel(order);
  const docNumber =
    order.sale?.invoiceNumber ?? order.invoiceNumber ?? order.orderCode;

  const runPrint = async (forPdf: boolean) => {
    setPreviewOpen(false);
    setPdfOpen(false);
    const prevTitle = document.title;
    if (forPdf) {
      const clean = filename.trim().replace(/\.pdf$/i, '') || 'Invoice';
      document.title = clean;
    }
    try {
      if (!order.invoicePrinted) {
        await recordPrinted.mutateAsync({ orderId: order.id });
      }
    } catch {
      // Allow print even if audit write fails.
    }
    window.setTimeout(() => {
      window.print();
      if (forPdf) {
        window.setTimeout(() => {
          document.title = prevTitle;
        }, 400);
      }
    }, 40);
  };

  return (
    <div className={`ga-invoice ga-invoice--${printSize}`}>
      <div className="ga-invoice__toolbar no-print">
        <button
          type="button"
          className="ga-invoice__btn"
          onClick={() => setPreviewOpen(true)}
        >
          Print Preview
        </button>
        <button
          type="button"
          className="ga-invoice__btn ga-invoice__btn--secondary"
          disabled={!hasInvoiceDoc}
          title={
            hasInvoiceDoc
              ? 'Opens the browser print dialog — choose Save as PDF'
              : 'Create Invoice to enable print / save as PDF'
          }
          onClick={() => {
            setPrintSize(printSize);
            setPdfOpen(true);
          }}
        >
          Print / Save as PDF
        </button>
        {!hasInvoiceDoc ? (
          <span className="ga-invoice__hint">
            Confirm order → Create Invoice unlocks print / save as PDF.
          </span>
        ) : converted ? (
          <span className="ga-invoice__hint">
            Sale {order.sale?.invoiceNumber} · Lines & totals from sales /
            sale_items · Browser print (no stored PDF)
          </span>
        ) : (
          <span className="ga-invoice__hint">
            Invoice {order.invoiceNumber} · Pre-sale document · Browser print
            (no stored PDF)
          </span>
        )}
      </div>

      {previewOpen ? (
        <div className="ga-invoice__dialog no-print" role="dialog" aria-modal>
          <div className="ga-invoice__dialog-card">
            <h3>Print Preview</h3>
            <p>Select print size, then print or open save-as-PDF via the browser.</p>
            <fieldset className="ga-invoice__sizes ga-invoice__sizes--dialog">
              <legend>Print Size</legend>
              {(Object.keys(SIZE_LABELS) as InvoicePrintSize[]).map((size) => (
                <label key={size} className="ga-invoice__size-option">
                  <input
                    type="radio"
                    name="invoice-preview-size"
                    checked={printSize === size}
                    onChange={() => setPrintSize(size)}
                  />
                  {SIZE_LABELS[size]}
                </label>
              ))}
            </fieldset>
            <div className="ga-invoice__dialog-actions">
              <button
                type="button"
                className="ga-invoice__btn ga-invoice__btn--secondary"
                onClick={() => setPreviewOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ga-invoice__btn ga-invoice__btn--secondary"
                onClick={() => {
                  setPreviewOpen(false);
                  setPdfOpen(true);
                }}
              >
                Print / Save as PDF
              </button>
              <button
                type="button"
                className="ga-invoice__btn"
                onClick={() => void runPrint(false)}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pdfOpen ? (
        <div className="ga-invoice__dialog no-print" role="dialog" aria-modal>
          <div className="ga-invoice__dialog-card">
            <h3>Print / Save as PDF</h3>
            <p className="ga-invoice__dialog-note">
              No PDF file is generated or stored. This opens the browser print
              dialog — choose &quot;Save as PDF&quot; (or equivalent) as the
              destination. The suggested filename below is applied to the print
              job title when available.
            </p>
            <fieldset className="ga-invoice__sizes ga-invoice__sizes--dialog">
              <legend>Print Size</legend>
              {(Object.keys(SIZE_LABELS) as InvoicePrintSize[]).map((size) => (
                <label key={size} className="ga-invoice__size-option">
                  <input
                    type="radio"
                    name="invoice-pdf-size"
                    checked={printSize === size}
                    onChange={() => setPrintSize(size)}
                  />
                  {SIZE_LABELS[size]}
                </label>
              ))}
            </fieldset>
            <label className="ga-invoice__filename">
              Suggested filename (print job title)
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="Invoice-1025.pdf"
              />
            </label>
            <div className="ga-invoice__dialog-actions">
              <button
                type="button"
                className="ga-invoice__btn ga-invoice__btn--secondary"
                onClick={() => setPdfOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ga-invoice__btn"
                onClick={() => void runPrint(true)}
              >
                Open browser print
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <article
        className={`ga-invoice__sheet ga-invoice__sheet--${printSize}`}
        id="ga-order-invoice"
        data-print-size={printSize}
      >
        <header className="ga-invoice__header">
          <div className="ga-invoice__seller-block">
            <p className="ga-invoice__party-label">Seller Details</p>
            {company.logoUrl ? (
              <img
                className="ga-invoice__logo"
                src={company.logoUrl}
                alt={company.companyName}
              />
            ) : null}
            <p className="ga-invoice__brand">{company.companyName}</p>
            <p className="ga-invoice__meta">{company.businessAddress}</p>
            <p className="ga-invoice__meta">{company.phoneLabel}</p>
            <p className="ga-invoice__meta">{company.email}</p>
            {company.gstNumber ? (
              <p className="ga-invoice__meta">GSTIN: {company.gstNumber}</p>
            ) : null}
            {company.pan ? (
              <p className="ga-invoice__meta">PAN: {company.pan}</p>
            ) : null}
          </div>
          <div className="ga-invoice__buyer-block">
            <p className="ga-invoice__party-label">Buyer Details</p>
            <p className="ga-invoice__strong">{order.customerName}</p>
            <p>{shopName}</p>
            <p>{order.deliveryAddress ?? order.delivery.addressText}</p>
            <p>{order.customerMobile ?? '—'}</p>
            <p className="ga-invoice__meta-tight">
              Order: {order.orderCode} · Invoice: {docNumber}
            </p>
            <p className="ga-invoice__meta-tight">Date: {invoiceDate}</p>
          </div>
        </header>

        <table className="ga-invoice__table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line, index) => (
              <tr key={line.id}>
                <td>{index + 1}</td>
                <td>
                  <span className="ga-invoice__prod">
                    {line.productName || line.skuName}
                  </span>
                  <span className="ga-invoice__sku">{line.skuCode}</span>
                </td>
                <td>{line.quantityLabel}</td>
                <td>{line.unitPriceLabel}</td>
                <td>{line.lineTotalLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="ga-invoice__summary">
          <dl className="ga-invoice__totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{order.payment.subtotalLabel}</dd>
            </div>
            <div className="ga-invoice__grand">
              <dt>Grand Total</dt>
              <dd>{order.payment.totalLabel}</dd>
            </div>
          </dl>
        </section>

        <footer className="ga-invoice__footer">
          <div className="ga-invoice__signs">
            <div>
              <div className="ga-invoice__sign-line" />
              <p>Authorized Signature</p>
            </div>
            <div>
              <div className="ga-invoice__sign-line" />
              <p>Customer Signature</p>
            </div>
          </div>
          <div className="ga-invoice__footer-text">
            <p className="ga-invoice__terms">
              Terms: Goods once sold will not be taken back. Payment due as per
              wholesale terms. Subject to local jurisdiction.
            </p>
            <p className="ga-invoice__thanks">Thank you for your business.</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
