// frontend/src/services/pdfPrint.js
// ─── Universal Print/PDF Engine for St. Everest Mediplex ─────────────────
// Uses browser print API — no dependencies needed
// Call printDocument(template) from anywhere in the app

// ─── Hospital Config ──────────────────────────────────────────────────────
const HOSPITAL = {
  name:      "St. Everest Mediplex",
  tagline:   "Quality Healthcare for All",
  address:   "P.O. Box 1234, Benin, Nigeria",
  phone:     "+254 700 000 000",
  email:     "info@steverestmediplex.com",
  website:   "www.steverestmediplex.com",
  license:   "MOH/HF/2024/001234",
  // Base64 logo — replace with real logo
  // logoBase64: "data:image/png;base64,..."
}

// ─── Shared CSS for all documents ─────────────────────────────────────────
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1a1a2e;
    background: white;
    padding: 0;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 15mm 20mm 20mm 20mm;
    position: relative;
  }

  /* ── Letterhead ── */
  .letterhead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 3px solid #1e40af;
    margin-bottom: 6px;
  }

  .letterhead-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-circle {
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #1e40af, #3b82f6);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 20px;
    font-weight: 900;
    letter-spacing: -1px;
    flex-shrink: 0;
  }

  .hospital-name {
    font-size: 20pt;
    font-weight: 800;
    color: #1e40af;
    line-height: 1.1;
  }

  .hospital-tagline {
    font-size: 9pt;
    color: #6b7280;
    font-style: italic;
    margin-top: 2px;
  }

  .letterhead-right {
    text-align: right;
    font-size: 8.5pt;
    color: #4b5563;
    line-height: 1.6;
  }

  .sub-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    margin-bottom: 18px;
    padding: 5px 10px;
    background: #eff6ff;
    border-radius: 5px;
    font-size: 8.5pt;
    color: #3b82f6;
  }

  /* ── Document title ── */
  .doc-title {
    text-align: center;
    margin-bottom: 20px;
  }

  .doc-title h1 {
    font-size: 15pt;
    font-weight: 700;
    color: #1e40af;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .doc-title .doc-number {
    font-size: 9pt;
    color: #6b7280;
    margin-top: 3px;
  }

  .title-divider {
    height: 2px;
    background: linear-gradient(to right, #1e40af, #93c5fd, transparent);
    margin-top: 8px;
    border: none;
  }

  /* ── Section boxes ── */
  .section {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 9pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: #1e40af;
    border-bottom: 1px solid #bfdbfe;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }

  /* ── Info grid ── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 20px;
  }

  .info-row {
    display: flex;
    gap: 6px;
    font-size: 10pt;
  }

  .info-label {
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
    min-width: 110px;
  }

  .info-value {
    color: #1f2937;
  }

  /* ── Patient box ── */
  .patient-box {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-left: 4px solid #0284c7;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }

  .patient-name {
    font-size: 13pt;
    font-weight: 700;
    color: #0c4a6e;
  }

  .patient-meta {
    font-size: 9pt;
    color: #0369a1;
    margin-top: 3px;
    display: flex;
    gap: 16px;
  }

  /* ── Content areas ── */
  .content-box {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 12px;
    font-size: 10.5pt;
    line-height: 1.6;
    color: #1f2937;
  }

  .highlight-box {
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-left: 4px solid #f59e0b;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 12px;
    font-size: 10pt;
  }

  .alert-box {
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-left: 4px solid #ef4444;
    border-radius: 6px;
    padding: 10px 14px;
    margin-bottom: 12px;
    font-size: 10pt;
  }

  /* ── Table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10pt;
    margin-bottom: 12px;
  }

  thead tr {
    background: #1e40af;
    color: white;
  }

  thead th {
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 9pt;
  }

  tbody tr:nth-child(even) {
    background: #f8fafc;
  }

  tbody tr:nth-child(odd) {
    background: white;
  }

  tbody td {
    padding: 7px 10px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }

  .table-total-row td {
    font-weight: 700;
    border-top: 2px solid #1e40af;
    border-bottom: none;
    background: #eff6ff !important;
  }

  /* ── Vitals strip ── */
  .vitals-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 12px;
  }

  .vital-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
    text-align: center;
  }

  .vital-label {
    font-size: 8pt;
    color: #64748b;
    margin-bottom: 3px;
  }

  .vital-value {
    font-size: 12pt;
    font-weight: 700;
    color: #1e40af;
  }

  .vital-unit {
    font-size: 8pt;
    color: #94a3b8;
  }

  /* ── Signature section ── */
  .signature-section {
    display: flex;
    justify-content: space-between;
    margin-top: 30px;
    gap: 40px;
  }

  .signature-block {
    flex: 1;
    text-align: center;
  }

  .signature-line {
    border-top: 1px solid #374151;
    margin-bottom: 5px;
    margin-top: 35px;
  }

  .signature-name {
    font-weight: 700;
    font-size: 10.5pt;
    color: #1f2937;
  }

  .signature-role {
    font-size: 9pt;
    color: #6b7280;
  }

  /* ── Stamp area ── */
  .stamp-area {
    width: 100px;
    height: 100px;
    border: 2px dashed #d1d5db;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #d1d5db;
    font-size: 8pt;
    text-align: center;
    margin: 0 auto;
  }

  /* ── Footer ── */
  .doc-footer {
    position: absolute;
    bottom: 15mm;
    left: 20mm;
    right: 20mm;
    border-top: 1px solid #e5e7eb;
    padding-top: 6px;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #9ca3af;
  }

  .footer-center {
    text-align: center;
    flex: 1;
  }

  /* ── Watermark ── */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72pt;
    font-weight: 900;
    color: rgba(30, 64, 175, 0.04);
    white-space: nowrap;
    pointer-events: none;
    z-index: 0;
  }

  /* ── Stamp: CONFIDENTIAL ── */
  .confidential {
    display: inline-block;
    border: 2px solid #dc2626;
    color: #dc2626;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 2px 8px;
    border-radius: 3px;
    text-transform: uppercase;
    transform: rotate(-5deg);
  }

  /* ── Barcode placeholder ── */
  .barcode-area {
    text-align: right;
    font-size: 7pt;
    color: #9ca3af;
    font-family: monospace;
  }

  @media print {
    body { padding: 0; }
    .page { margin: 0; padding: 15mm 20mm 20mm 20mm; }
    @page { size: A4; margin: 0; }
  }
`

// ─── Letterhead HTML builder ───────────────────────────────────────────────
const buildLetterhead = (docType = "", docNumber = "", date = "") => `
  <div class="letterhead">
    <div class="letterhead-left">
      <div class="logo-circle">SE</div>
      <div>
        <div class="hospital-name">${HOSPITAL.name}</div>
        <div class="hospital-tagline">${HOSPITAL.tagline}</div>
      </div>
    </div>
    <div class="letterhead-right">
      <div>${HOSPITAL.address}</div>
      <div>Tel: ${HOSPITAL.phone}</div>
      <div>${HOSPITAL.email}</div>
      <div>License: ${HOSPITAL.license}</div>
    </div>
  </div>
  <div class="sub-header">
    <span>${HOSPITAL.website}</span>
    <span>${docType ? `Document: ${docType}` : ""}</span>
    <span>${date || new Date().toLocaleDateString("en-KE", { day:"2-digit", month:"long", year:"numeric" })}</span>
  </div>
`

// ─── Footer HTML builder ────────────────────────────────────────────────────
const buildFooter = (docNumber = "", extra = "") => `
  <div class="doc-footer">
    <span>${HOSPITAL.name} · ${HOSPITAL.address}</span>
    <span class="footer-center">
      ${docNumber ? `Ref: ${docNumber} · ` : ""}
      This document is computer-generated${extra ? ` · ${extra}` : ""}
    </span>
    <span>Printed: ${new Date().toLocaleString("en-KE")}</span>
  </div>
`

// ─── Core print function ────────────────────────────────────────────────────
export const printDocument = (htmlContent, title = "St. Everest Mediplex") => {
  const printWindow = window.open("", "_blank", "width=900,height=700")
  if (!printWindow) {
    alert("Pop-up blocked. Please allow pop-ups for this site to print documents.")
    return
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${title} — ${HOSPITAL.name}</title>
      <style>${BASE_CSS}</style>
    </head>
    <body>
      ${htmlContent}
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print()
            // Don't auto-close — let user verify before closing
          }, 400)
        }
      </script>
    </body>
    </html>
  `)
  printWindow.document.close()
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 1 — DOCTOR'S NOTE / MEDICAL CERTIFICATE
// ════════════════════════════════════════════════════════════════════════════
export const printDoctorNote = ({
  patient,
  doctor,
  visit,
  diagnosis,
  notes,
  recommendation,
  restDays,
  followUpDate,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const html = `
    <div class="page">
      <div class="watermark">MEDICAL</div>

      ${buildLetterhead("Medical Certificate", docNumber, today)}

      <div class="doc-title">
        <h1>Medical Certificate / Doctor's Note</h1>
        <div class="doc-number">Ref: ${docNumber || visit?.visitId || "—"}</div>
        <hr class="title-divider" />
      </div>

      <!-- Patient -->
      <div class="patient-box">
        <div class="patient-name">${patient?.fullName || "—"}</div>
        <div class="patient-meta">
          <span>ID: ${patient?.patientId || "—"}</span>
          <span>Age: ${patient?.dateOfBirth
            ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years`
            : "—"
          }</span>
          <span>Gender: ${patient?.gender || "—"}</span>
          <span>Phone: ${patient?.phone || "—"}</span>
        </div>
      </div>

      <!-- TO WHOM IT MAY CONCERN -->
      <div class="section">
        <p style="font-size:10.5pt; margin-bottom:14px; line-height:1.7;">
          To Whom It May Concern,
        </p>
        <p style="font-size:10.5pt; line-height:1.8;">
          This is to certify that <strong>${patient?.fullName || "the above patient"}</strong>
          (${patient?.gender || ""}, ${patient?.dateOfBirth
            ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years old`
            : ""
          }) attended St. Everest Mediplex on
          <strong>${today}</strong> and was examined by the undersigned medical officer.
        </p>
      </div>

      <!-- Diagnosis -->
      <div class="section">
        <div class="section-title">Clinical Findings & Diagnosis</div>
        <div class="content-box">
          ${diagnosis || "As assessed by the attending physician."}
        </div>
      </div>

      <!-- Notes -->
      ${notes ? `
      <div class="section">
        <div class="section-title">Clinical Notes</div>
        <div class="content-box">${notes}</div>
      </div>
      ` : ""}

      <!-- Recommendation -->
      ${recommendation ? `
      <div class="section">
        <div class="section-title">Recommendation</div>
        <div class="highlight-box">${recommendation}</div>
      </div>
      ` : ""}

      <!-- Rest period -->
      ${restDays ? `
      <div class="alert-box">
        <strong>Rest Period:</strong> The patient is advised to rest for
        <strong>${restDays} day(s)</strong> from ${today}.
        ${followUpDate ? `Follow-up appointment: <strong>${followUpDate}</strong>.` : ""}
      </div>
      ` : ""}

      <!-- Signature -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${doctor?.name ? `Dr. ${doctor.name}` : "Attending Physician"}
          </div>
          <div class="signature-role">
            ${doctor?.specialization || "Medical Officer"}
          </div>
          <div class="signature-role">
            Reg No: ${doctor?.registrationNumber || "MOH/MD/—"}
          </div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      ${buildFooter(docNumber, "Confidential — For official use only")}
    </div>
  `
  printDocument(html, "Medical Certificate")
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 2 — REFERRAL LETTER
// ════════════════════════════════════════════════════════════════════════════
export const printReferralLetter = ({
  patient,
  doctor,
  visit,
  referredTo,
  referralReason,
  clinicalSummary,
  urgency,
  diagnosis,
  currentMedications,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const urgencyColors = {
    ROUTINE:   "color:#16a34a; border-color:#16a34a;",
    URGENT:    "color:#d97706; border-color:#d97706;",
    EMERGENCY: "color:#dc2626; border-color:#dc2626;",
  }
  const urgencyStyle = urgencyColors[urgency] || urgencyColors.ROUTINE

  const html = `
    <div class="page">
      <div class="watermark">REFERRAL</div>

      ${buildLetterhead("Referral Letter", docNumber, today)}

      <div class="doc-title">
        <h1>Referral Letter</h1>
        <div class="doc-number">
          Ref: ${docNumber || visit?.visitId || "—"}
          &nbsp;·&nbsp;
          <span style="display:inline-block; border:1.5px solid; padding:1px 8px; border-radius:3px; font-size:9pt; font-weight:700; ${urgencyStyle}">
            ${urgency || "ROUTINE"}
          </span>
        </div>
        <hr class="title-divider" />
      </div>

      <!-- Addressed to -->
      <div class="section">
        <p style="font-size:10.5pt; line-height:1.8; margin-bottom:12px;">
          <strong>To:</strong> ${referredTo || "The Attending Specialist / Facility"}<br/>
          <strong>From:</strong> Dr. ${doctor?.name || "Attending Physician"}, ${HOSPITAL.name}<br/>
          <strong>Date:</strong> ${today}
        </p>
      </div>

      <!-- Patient -->
      <div class="patient-box">
        <div class="patient-name">${patient?.fullName || "—"}</div>
        <div class="patient-meta">
          <span>ID: ${patient?.patientId || "—"}</span>
          <span>Age: ${patient?.dateOfBirth
            ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years`
            : "—"
          }</span>
          <span>Gender: ${patient?.gender || "—"}</span>
          <span>Phone: ${patient?.phone || "—"}</span>
          ${patient?.address ? `<span>Address: ${patient.address}</span>` : ""}
        </div>
      </div>

      <!-- Reason for referral -->
      <div class="section">
        <div class="section-title">Reason for Referral</div>
        <div class="highlight-box">${referralReason || "—"}</div>
      </div>

      <!-- Diagnosis -->
      <div class="section">
        <div class="section-title">Working Diagnosis</div>
        <div class="content-box">${diagnosis || "—"}</div>
      </div>

      <!-- Clinical summary -->
      ${clinicalSummary ? `
      <div class="section">
        <div class="section-title">Clinical Summary</div>
        <div class="content-box" style="line-height:1.8;">${clinicalSummary}</div>
      </div>
      ` : ""}

      <!-- Current medications -->
      ${currentMedications?.length ? `
      <div class="section">
        <div class="section-title">Current Medications</div>
        <table>
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            ${currentMedications.map(m => `
              <tr>
                <td>${m.drugName || m.name || "—"}</td>
                <td>${m.dose || m.dosage || "—"}</td>
                <td>${m.frequency || "—"}</td>
                <td>${m.duration || "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      <!-- Closing -->
      <div class="section">
        <p style="font-size:10.5pt; line-height:1.8;">
          We kindly request your expert assessment and management of this patient.
          Please do not hesitate to contact us for further information.
          <br/>Thank you for your kind cooperation.
        </p>
      </div>

      <!-- Signature -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${doctor?.name ? `Dr. ${doctor.name}` : "Attending Physician"}
          </div>
          <div class="signature-role">
            ${doctor?.specialization || "Medical Officer"}
          </div>
          <div class="signature-role">
            Reg No: ${doctor?.registrationNumber || "MOH/MD/—"}
          </div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      ${buildFooter(docNumber)}
    </div>
  `
  printDocument(html, "Referral Letter")
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 3 — LAB RESULTS REPORT
// ════════════════════════════════════════════════════════════════════════════
export const printLabResults = ({
  patient,
  doctor,
  labScientist,
  visit,
  labOrder,
  results,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const getResultStatus = (result) => {
    if (!result.referenceRange || !result.value) return ""
    const val  = parseFloat(result.value)
    const [min, max] = (result.referenceRange || "").split("-").map(Number)
    if (!isNaN(min) && !isNaN(max)) {
      if (val < min) return "LOW"
      if (val > max) return "HIGH"
      return "NORMAL"
    }
    return ""
  }

  const statusStyle = (s) => {
    if (s === "HIGH") return "color:#dc2626; font-weight:700;"
    if (s === "LOW")  return "color:#2563eb; font-weight:700;"
    return "color:#16a34a;"
  }

  const html = `
    <div class="page">
      <div class="watermark">LABORATORY</div>

      ${buildLetterhead("Laboratory Report", docNumber, today)}

      <div class="doc-title">
        <h1>Laboratory Results Report</h1>
        <div class="doc-number">
          Order No: ${labOrder?.orderNumber || docNumber || "—"}
          &nbsp;·&nbsp;
          Date Ordered: ${labOrder?.createdAt
            ? new Date(labOrder.createdAt).toLocaleDateString("en-KE")
            : today
          }
        </div>
        <hr class="title-divider" />
      </div>

      <!-- Patient info grid -->
      <div class="patient-box">
        <div class="patient-name">${patient?.fullName || "—"}</div>
        <div class="patient-meta">
          <span>Patient ID: ${patient?.patientId || "—"}</span>
          <span>Age: ${patient?.dateOfBirth
            ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs`
            : "—"
          }</span>
          <span>Gender: ${patient?.gender || "—"}</span>
          <span>Visit: ${visit?.visitId || "—"}</span>
        </div>
      </div>

      <!-- Requesting doctor -->
      <div class="section">
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Requested By:</span>
            <span class="info-value">
              ${doctor?.name ? `Dr. ${doctor.name}` : "—"}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Date Collected:</span>
            <span class="info-value">
              ${labOrder?.collectedAt
                ? new Date(labOrder.collectedAt).toLocaleDateString("en-KE")
                : today
              }
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Lab Scientist:</span>
            <span class="info-value">${labScientist?.name || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date Reported:</span>
            <span class="info-value">${today}</span>
          </div>
        </div>
      </div>

      <!-- Results table -->
      <div class="section">
        <div class="section-title">Test Results</div>
        <table>
          <thead>
            <tr>
              <th>Test</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference Range</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${(results || []).map(r => {
              const status = getResultStatus(r)
              return `
                <tr>
                  <td><strong>${r.testName || r.name || "—"}</strong></td>
                  <td style="${statusStyle(status)}">${r.value || "Pending"}</td>
                  <td>${r.unit || "—"}</td>
                  <td>${r.referenceRange || "—"}</td>
                  <td style="${statusStyle(status)}">${status || "—"}</td>
                </tr>
              `
            }).join("")}
          </tbody>
        </table>
      </div>

      <!-- Abnormal results highlight -->
      ${(results || []).some(r => ["HIGH","LOW"].includes(getResultStatus(r))) ? `
      <div class="alert-box">
        <strong>⚠ Abnormal Results Detected:</strong>
        ${(results || [])
          .filter(r => ["HIGH","LOW"].includes(getResultStatus(r)))
          .map(r => `${r.testName}: ${r.value} ${r.unit || ""} (${getResultStatus(r)})`)
          .join(" · ")
        }
      </div>
      ` : `
      <div class="highlight-box">
        ✓ All results are within normal reference ranges.
      </div>
      `}

      <!-- Comments -->
      ${labOrder?.comments ? `
      <div class="section">
        <div class="section-title">Comments</div>
        <div class="content-box">${labOrder.comments}</div>
      </div>
      ` : ""}

      <!-- Signature -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${doctor?.name ? `Dr. ${doctor.name}` : "Requesting Physician"}
          </div>
          <div class="signature-role">Requesting Physician</div>
        </div>
        <div class="signature-block">
          <div class="stamp-area">LAB<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${labScientist?.name || "Laboratory Scientist"}
          </div>
          <div class="signature-role">Laboratory Scientist</div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      <div style="margin-top:10px; font-size:8.5pt; color:#6b7280; font-style:italic;">
        * Results marked HIGH or LOW require clinical correlation.
        This report is valid for 30 days from date of issue.
      </div>

      ${buildFooter(labOrder?.orderNumber || docNumber)}
    </div>
  `
  printDocument(html, "Lab Results")
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 4 — PRESCRIPTION / MEDICATION LIST
// ════════════════════════════════════════════════════════════════════════════
export const printPrescription = ({
  patient,
  doctor,
  visit,
  prescription,
  items,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const html = `
    <div class="page">
      <div class="watermark">Rx</div>

      ${buildLetterhead("Prescription", docNumber, today)}

      <div class="doc-title">
        <h1>Prescription</h1>
        <div class="doc-number">
          Rx No: ${prescription?.prescriptionNumber || docNumber || "—"}
          &nbsp;·&nbsp; ${today}
        </div>
        <hr class="title-divider" />
      </div>

      <!-- Rx symbol header -->
      <div style="font-size:32pt; color:#1e40af; font-weight:900; margin-bottom:8px;">℞</div>

      <!-- Patient -->
      <div class="patient-box">
        <div class="patient-name">${patient?.fullName || "—"}</div>
        <div class="patient-meta">
          <span>ID: ${patient?.patientId || "—"}</span>
          <span>Age: ${patient?.dateOfBirth
            ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs`
            : "—"
          }</span>
          <span>Gender: ${patient?.gender || "—"}</span>
          <span>Weight: ${patient?.weight || "—"}</span>
        </div>
      </div>

      <!-- Medications -->
      <div class="section">
        <div class="section-title">Prescribed Medications</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Medication</th>
              <th>Strength</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Route</th>
              <th>Qty</th>
            </tr>
          </thead>
          <tbody>
            ${(items || []).map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><strong>${item.drugName || item.name || "—"}</strong></td>
                <td>${item.strength || "—"}</td>
                <td>${item.dose || item.dosage || "—"}</td>
                <td>${item.frequency || "—"}</td>
                <td>${item.duration || "—"}</td>
                <td>${item.route || "Oral"}</td>
                <td>${item.quantity || "—"}</td>
              </tr>
              ${item.instructions ? `
              <tr>
                <td></td>
                <td colspan="7" style="font-size:9pt; color:#4b5563; font-style:italic; padding-top:2px;">
                  Instructions: ${item.instructions}
                </td>
              </tr>
              ` : ""}
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- General instructions -->
      ${prescription?.notes ? `
      <div class="section">
        <div class="section-title">General Instructions</div>
        <div class="content-box">${prescription.notes}</div>
      </div>
      ` : ""}

      <!-- Allergy warning -->
      ${patient?.allergies ? `
      <div class="alert-box">
        <strong>⚠ Known Allergies:</strong> ${patient.allergies}
      </div>
      ` : ""}

      <!-- Dispensing info -->
      <div class="highlight-box" style="margin-top:20px;">
        <div style="display:flex; justify-content:space-between;">
          <div>
            <strong>Dispensed By:</strong> ___________________________
          </div>
          <div>
            <strong>Date Dispensed:</strong> ___________________________
          </div>
          <div>
            <strong>Signature:</strong> ___________________________
          </div>
        </div>
      </div>

      <!-- Signature -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${doctor?.name ? `Dr. ${doctor.name}` : "Prescribing Physician"}
          </div>
          <div class="signature-role">
            ${doctor?.specialization || "Medical Officer"}
          </div>
          <div class="signature-role">
            Reg No: ${doctor?.registrationNumber || "MOH/MD/—"}
          </div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      <div style="margin-top:10px; font-size:8.5pt; color:#6b7280; font-style:italic;">
        * This prescription is valid for 30 days from date of issue.
        Not valid if altered. Dispense as written.
      </div>

      ${buildFooter(prescription?.prescriptionNumber || docNumber)}
    </div>
  `
  printDocument(html, "Prescription")
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 5 — BILL / INVOICE
// ════════════════════════════════════════════════════════════════════════════
export const printBill = ({
  patient,
  bill,
  items,
  payments,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const totalAmount  = items?.reduce((s, i) => s + (Number(i.amount) || 0), 0) || 0
  const totalPaid    = payments?.reduce((s, p) => s + (Number(p.amount) || 0), 0) || 0
  const balance      = totalAmount - totalPaid
  const isPaid       = balance <= 0

  const fmt = (n) => `KES ${Number(n || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2
  })}`

  const html = `
    <div class="page">
      <div class="watermark">${isPaid ? "PAID" : "INVOICE"}</div>

      ${buildLetterhead("Invoice", bill?.billNumber || docNumber, today)}

      <div class="doc-title">
        <h1>${isPaid ? "Receipt" : "Invoice / Bill"}</h1>
        <div class="doc-number">
          Bill No: ${bill?.billNumber || docNumber || "—"}
          &nbsp;·&nbsp; ${today}
          &nbsp;·&nbsp;
          <span style="display:inline-block; border:1.5px solid; padding:1px 8px; border-radius:3px; font-weight:700; font-size:9pt; ${
            isPaid
              ? "color:#16a34a; border-color:#16a34a;"
              : "color:#d97706; border-color:#d97706;"
          }">
            ${isPaid ? "PAID" : "OUTSTANDING"}
          </span>
        </div>
        <hr class="title-divider" />
      </div>

      <!-- Patient -->
      <div class="patient-box">
        <div class="patient-name">${patient?.fullName || "—"}</div>
        <div class="patient-meta">
          <span>ID: ${patient?.patientId || "—"}</span>
          <span>Phone: ${patient?.phone || "—"}</span>
          ${patient?.address ? `<span>${patient.address}</span>` : ""}
        </div>
      </div>

      <!-- Bill items -->
      <div class="section">
        <div class="section-title">Services & Charges</div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Amount (KES)</th>
            </tr>
          </thead>
          <tbody>
            ${(items || []).map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.description || item.name || "—"}</td>
                <td>${item.category || "—"}</td>
                <td>${item.quantity || 1}</td>
                <td>${fmt(item.unitPrice || item.amount)}</td>
                <td><strong>${fmt(item.amount)}</strong></td>
              </tr>
            `).join("")}
            <tr class="table-total-row">
              <td colspan="5" style="text-align:right;">
                <strong>TOTAL</strong>
              </td>
              <td><strong>${fmt(totalAmount)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payments received -->
      ${payments?.length ? `
      <div class="section">
        <div class="section-title">Payments Received</div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Amount (KES)</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr>
                <td>${p.date
                  ? new Date(p.date).toLocaleDateString("en-KE")
                  : today
                }</td>
                <td>${p.method || p.paymentMethod || "—"}</td>
                <td>${p.reference || p.transactionId || "—"}</td>
                <td>${fmt(p.amount)}</td>
              </tr>
            `).join("")}
            <tr class="table-total-row">
              <td colspan="3" style="text-align:right;">
                <strong>TOTAL PAID</strong>
              </td>
              <td><strong>${fmt(totalPaid)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ""}

      <!-- Balance summary -->
      <div style="
        display:flex;
        justify-content:flex-end;
        margin-bottom:20px;
      ">
        <div style="
          background:${isPaid ? "#f0fdf4" : "#fef2f2"};
          border:2px solid ${isPaid ? "#16a34a" : "#ef4444"};
          border-radius:8px;
          padding:14px 24px;
          text-align:right;
          min-width:220px;
        ">
          <div style="font-size:9pt; color:#6b7280; margin-bottom:4px;">
            Balance Due
          </div>
          <div style="
            font-size:18pt;
            font-weight:800;
            color:${isPaid ? "#16a34a" : "#dc2626"};
          ">
            ${fmt(Math.max(0, balance))}
          </div>
          ${isPaid ? `
          <div style="
            font-size:10pt;
            color:#16a34a;
            font-weight:600;
            margin-top:4px;
          ">
            ✓ Fully Paid
          </div>
          ` : ""}
        </div>
      </div>

      <!-- Payment instructions -->
      ${!isPaid ? `
      <div class="highlight-box">
        <strong>Payment Methods Accepted:</strong>
        M-Pesa Paybill: <strong>123456</strong> (Account: ${bill?.billNumber || "Bill No"}) ·
        Cash at Cashier's Office ·
        Bank Transfer: KCB Bank A/C 1234567890
      </div>
      ` : ""}

      <!-- Cashier signature -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">Cashier / Accounts Officer</div>
          <div class="signature-role">Finance Department</div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      <div style="margin-top:8px; font-size:8.5pt; color:#6b7280; font-style:italic;">
        * This is a computer-generated document. Please retain for your records.
        For queries, contact the Finance Office at ${HOSPITAL.phone}.
      </div>

      ${buildFooter(bill?.billNumber || docNumber)}
    </div>
  `
  printDocument(html, isPaid ? "Receipt" : "Invoice")
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 6 — DISCHARGE SUMMARY
// ════════════════════════════════════════════════════════════════════════════
export const printDischargeSummary = ({
  patient,
  doctor,
  admission,
  diagnosis,
  procedures,
  dischargeMedications,
  followUpDate,
  followUpNotes,
  condition,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const admitDate = admission?.admittedAt
    ? new Date(admission.admittedAt).toLocaleDateString("en-KE")
    : "—"

  const dischargeDate = admission?.dischargedAt
    ? new Date(admission.dischargedAt).toLocaleDateString("en-KE")
    : today

  const stayDays = admission?.admittedAt
    ? Math.ceil(
        (new Date(admission.dischargedAt || Date.now()) - new Date(admission.admittedAt))
        / 86400000
      )
    : "—"

  const html = `
    <div class="page">
      <div class="watermark">DISCHARGE</div>

      ${buildLetterhead("Discharge Summary", docNumber, today)}

      <div class="doc-title">
        <h1>Discharge Summary</h1>
        <div class="doc-number">
          Ref: ${docNumber || admission?.admissionNumber || "—"}
        </div>
        <hr class="title-divider" />
      </div>

      <!-- Patient -->
      <div class="patient-box">
        <div class="patient-name">${patient?.fullName || "—"}</div>
        <div class="patient-meta">
          <span>ID: ${patient?.patientId || "—"}</span>
          <span>Age: ${patient?.dateOfBirth
            ? `${new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()} yrs`
            : "—"
          }</span>
          <span>Gender: ${patient?.gender || "—"}</span>
          <span>Blood Group: ${patient?.bloodGroup || "—"}</span>
        </div>
      </div>

      <!-- Admission details -->
      <div class="section">
        <div class="section-title">Admission Details</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Admission No:</span>
            <span class="info-value">${admission?.admissionNumber || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ward / Bed:</span>
            <span class="info-value">
              ${admission?.ward?.name || "—"} · Bed ${admission?.bed?.bedNumber || "—"}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Date Admitted:</span>
            <span class="info-value">${admitDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date Discharged:</span>
            <span class="info-value">${dischargeDate}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Length of Stay:</span>
            <span class="info-value">${stayDays} day(s)</span>
          </div>
          <div class="info-row">
            <span class="info-label">Attending Doctor:</span>
            <span class="info-value">
              ${doctor?.name ? `Dr. ${doctor.name}` : "—"}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Condition at Discharge:</span>
            <span class="info-value" style="font-weight:600; color:#16a34a;">
              ${condition || "Stable"}
            </span>
          </div>
        </div>
      </div>

      <!-- Diagnosis -->
      <div class="section">
        <div class="section-title">Diagnosis</div>
        <div class="content-box">${diagnosis || "—"}</div>
      </div>

      <!-- Procedures -->
      ${procedures ? `
      <div class="section">
        <div class="section-title">Procedures Performed</div>
        <div class="content-box">${procedures}</div>
      </div>
      ` : ""}

      <!-- Discharge medications -->
      ${dischargeMedications?.length ? `
      <div class="section">
        <div class="section-title">Discharge Medications</div>
        <table>
          <thead>
            <tr>
              <th>Medication</th>
              <th>Dose</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${dischargeMedications.map(m => `
              <tr>
                <td><strong>${m.drugName || m.name || "—"}</strong></td>
                <td>${m.dose || m.dosage || "—"}</td>
                <td>${m.frequency || "—"}</td>
                <td>${m.duration || "—"}</td>
                <td>${m.instructions || "As directed"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      ` : ""}

      <!-- Follow-up -->
      ${followUpDate || followUpNotes ? `
      <div class="highlight-box">
        <strong>Follow-up Appointment:</strong>
        ${followUpDate
          ? `${new Date(followUpDate).toLocaleDateString("en-KE", {
              weekday:"long", day:"2-digit", month:"long", year:"numeric"
            })}`
          : "To be scheduled"
        }
        ${followUpNotes ? `<br/><em>${followUpNotes}</em>` : ""}
      </div>
      ` : ""}

      <!-- Signature -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${doctor?.name ? `Dr. ${doctor.name}` : "Attending Physician"}
          </div>
          <div class="signature-role">
            ${doctor?.specialization || "Medical Officer"}
          </div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      ${buildFooter(admission?.admissionNumber || docNumber)}
    </div>
  `
  printDocument(html, "Discharge Summary")
}

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE 7 — DEATH CERTIFICATE
// ════════════════════════════════════════════════════════════════════════════
export const printDeathCertificate = ({
  patient,
  doctor,
  mortuaryRecord,
  causeOfDeath,
  mannerOfDeath,
  dateOfDeath,
  timeOfDeath,
  placeOfDeath,
  docNumber,
}) => {
  const today = new Date().toLocaleDateString("en-KE", {
    day: "2-digit", month: "long", year: "numeric"
  })

  const html = `
    <div class="page">
      <div class="watermark">OFFICIAL</div>

      ${buildLetterhead("Death Certificate", docNumber, today)}

      <div class="doc-title">
        <h1>Certificate of Death</h1>
        <div class="doc-number">
          Certificate No: ${docNumber || mortuaryRecord?.mortuaryNumber || "—"}
        </div>
        <hr class="title-divider" />
      </div>

      <div style="
        text-align:center;
        font-size:10pt;
        color:#6b7280;
        margin-bottom:20px;
        font-style:italic;
      ">
        Issued pursuant to the Births and Deaths Registration Act (Cap. 149), Kenya
      </div>

      <!-- Deceased info -->
      <div class="section">
        <div class="section-title">Particulars of the Deceased</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Full Name:</span>
            <span class="info-value" style="font-weight:700; font-size:11.5pt;">
              ${patient?.fullName || "—"}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Patient ID:</span>
            <span class="info-value">${patient?.patientId || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Gender:</span>
            <span class="info-value">${patient?.gender || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date of Birth:</span>
            <span class="info-value">
              ${patient?.dateOfBirth
                ? new Date(patient.dateOfBirth).toLocaleDateString("en-KE", {
                    day:"2-digit", month:"long", year:"numeric"
                  })
                : "—"
              }
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Age at Death:</span>
            <span class="info-value">
              ${patient?.dateOfBirth && dateOfDeath
                ? `${new Date(dateOfDeath).getFullYear() - new Date(patient.dateOfBirth).getFullYear()} years`
                : "—"
              }
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Address:</span>
            <span class="info-value">${patient?.address || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">ID / Passport No:</span>
            <span class="info-value">${patient?.nationalId || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Nationality:</span>
            <span class="info-value">${patient?.nationality || "Kenyan"}</span>
          </div>
        </div>
      </div>

      <!-- Death details -->
      <div class="section">
        <div class="section-title">Particulars of Death</div>
        <div class="info-grid">
          <div class="info-row">
            <span class="info-label">Date of Death:</span>
            <span class="info-value" style="font-weight:700;">
              ${dateOfDeath
                ? new Date(dateOfDeath).toLocaleDateString("en-KE", {
                    weekday:"long", day:"2-digit", month:"long", year:"numeric"
                  })
                : "—"
              }
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">Time of Death:</span>
            <span class="info-value">${timeOfDeath || "—"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Place of Death:</span>
            <span class="info-value">${placeOfDeath || "St. Everest Mediplex"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Manner of Death:</span>
            <span class="info-value">${mannerOfDeath || "—"}</span>
          </div>
        </div>
      </div>

      <!-- Cause of death -->
      <div class="section">
        <div class="section-title">Cause of Death</div>
        <table>
          <thead>
            <tr>
              <th>Classification</th>
              <th>Condition</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>I(a) — Immediate Cause</strong></td>
              <td>${causeOfDeath?.immediate || "—"}</td>
            </tr>
            <tr>
              <td>I(b) — Due to / Consequence of</td>
              <td>${causeOfDeath?.dueTo || "—"}</td>
            </tr>
            <tr>
              <td>I(c) — Underlying Cause</td>
              <td>${causeOfDeath?.underlying || "—"}</td>
            </tr>
            <tr>
              <td>II — Other Contributing Conditions</td>
              <td>${causeOfDeath?.contributing || "—"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mortuary reference -->
      ${mortuaryRecord ? `
      <div class="info-grid" style="margin-bottom:16px;">
        <div class="info-row">
          <span class="info-label">Mortuary No:</span>
          <span class="info-value">${mortuaryRecord.mortuaryNumber || "—"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Body Tag No:</span>
          <span class="info-value">${mortuaryRecord.bodyTagNumber || "—"}</span>
        </div>
      </div>
      ` : ""}

      <!-- Certification -->
      <div class="content-box" style="margin-bottom:20px;">
        I, the undersigned, certify that the above information is true and correct
        to the best of my knowledge, and that the death occurred as stated above.
      </div>

      <!-- Signatures -->
      <div class="signature-section">
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">Next of Kin / Informant</div>
          <div class="signature-role">Relationship: _______________</div>
          <div class="signature-role">ID No: _______________</div>
        </div>
        <div class="signature-block">
          <div class="stamp-area">HOSPITAL<br/>STAMP</div>
        </div>
        <div class="signature-block">
          <div class="signature-line"></div>
          <div class="signature-name">
            ${doctor?.name ? `Dr. ${doctor.name}` : "Certifying Medical Officer"}
          </div>
          <div class="signature-role">
            ${doctor?.specialization || "Medical Officer"}
          </div>
          <div class="signature-role">
            Reg No: ${doctor?.registrationNumber || "MOH/MD/—"}
          </div>
          <div class="signature-role">${today}</div>
        </div>
      </div>

      <div style="margin-top:12px; font-size:8.5pt; color:#6b7280; font-style:italic;">
        * This certificate must be presented to the Civil Registration Office
        within 6 months of death for official registration.
        Certificate No: ${docNumber || mortuaryRecord?.mortuaryNumber || "—"}
      </div>

      ${buildFooter(docNumber || mortuaryRecord?.mortuaryNumber, "Official Document")}
    </div>
  `
  printDocument(html, "Death Certificate")
}