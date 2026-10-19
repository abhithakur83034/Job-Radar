"use client";

export function DraftActions({
  listingUrl,
  resumeText,
  coverLetterText,
}: {
  listingUrl: string;
  resumeText: string;
  coverLetterText: string;
}) {
  function downloadPdf() {
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Tailored resume</title>
      <style>body{font-family:ui-monospace,Consolas,monospace;white-space:pre-wrap;padding:40px;line-height:1.6;}</style>
      </head><body>${resumeText.replace(/</g, "&lt;")}</body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function copyAndOpen() {
    try {
      await navigator.clipboard.writeText(`${resumeText}\n\n---\n\n${coverLetterText}`);
    } catch {
      // clipboard permissions can be denied — opening the listing still proceeds
    }
    window.open(listingUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex gap-2.5">
      <button
        onClick={downloadPdf}
        className="rounded-[9px] border border-border bg-surface px-4 py-2 text-[13px] font-semibold"
      >
        Download PDF
      </button>
      <button
        onClick={copyAndOpen}
        className="rounded-[9px] bg-sidebar px-4 py-2 text-[13px] font-semibold text-white"
      >
        Copy & open listing ↗
      </button>
    </div>
  );
}
