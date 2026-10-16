async function generatePatientPDF(patientId) {
  const patient = await DB.getPatient(patientId);
  if (!patient) throw new Error('Paciente no encontrado');

  const settings = await DB.getClinicSettings();
  const services = await DB.getServicesByPatient(patientId);
  services.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

  const procedures = await DB.getPatientProceduresByPatient(patientId);
  procedures.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const el = document.createElement('div');
  el.innerHTML = buildPDFHtml(patient, settings, services, procedures);
  el.style.cssText = 'width:100%;max-width:794px;margin:0 auto;background:#fff;padding:0;';
  document.body.appendChild(el);

  const opt = {
    margin:       [8, 8, 8, 8],
    filename:     `Ficha_${patient.name.replace(/\s+/g, '_')}.pdf`,
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true, allowTaint: true, logging: false, width: 794 },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: 'css' }
  };

  try {
    await html2pdf().set(opt).from(el).save();
  } catch (e) {
    console.error('PDF error:', e);
    // Fallback: try native print
    try {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{margin:8mm;size:A4}body{margin:0;padding:0;background:#fff}*{box-sizing:border-box}</style></head><body>${buildPDFHtml(patient, settings, services, procedures)}</body></html>`);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 500);
      }
    } catch (e2) {
      alert('Error al generar el PDF. Revisá la consola para más detalles.');
    }
  } finally {
    el.remove();
  }
}

function extractMedications(notes) {
  if (!notes) return '';
  const match = notes.match(/\[Insumo utilizado: ([^\]]+)\]/);
  return match ? escapeHtml(match[1]) : '';
}

function buildPDFHtml(patient, settings, services, procedures) {
  const logoHtml = (settings.clinicLogo && settings.pdfShowLogo)
    ? `<img src="${settings.clinicLogo}" alt="Logo" style="max-height:65px;max-width:65px;object-fit:contain;border-radius:4px;"/>`
    : '';

  const fullName = patient.lastName ? `${escapeHtml(patient.name)} ${escapeHtml(patient.lastName)}` : escapeHtml(patient.name);
  const sexo = (patient.sex || '—') + (patient.neutered ? ' (Esterilizado/Castrado)' : '');
  const edad = [];
  if (patient.ageYears) edad.push(`${patient.ageYears} año${patient.ageYears !== 1 ? 's' : ''}`);
  if (patient.ageMonths) edad.push(`${patient.ageMonths} mes${patient.ageMonths !== 1 ? 'es' : ''}`);

  const servicesRows = services.length > 0
    ? services.map(s => {
        const meds = extractMedications(s.notes);
        return `<tr>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;white-space:nowrap;">${formatDateShort(s.date)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;font-weight:600;color:#0f172a;">${escapeHtml(s.serviceType)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#334155;">${escapeHtml(s.performedBy || '—')}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#475569;">${meds || '—'}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#334155;line-height:1.3;">${escapeHtml(s.notes || '')}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5" style="padding:15px;text-align:center;font-size:10px;color:#94a3b8;font-style:italic;">Sin servicios registrados</td></tr>';

  const proceduresRows = procedures.length > 0
    ? procedures.map(p => {
        const meds = extractMedications(p.notes);
        return `<tr>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;white-space:nowrap;">${formatDateShort(p.date)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#475569;"><span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:600;">${escapeHtml(p.category)}</span></td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;font-weight:600;color:#0f172a;">${escapeHtml(p.procedureName)}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#334155;">${escapeHtml(p.performedBy || '—')}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#475569;">${meds || '—'}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #eee;font-size:9px;color:#334155;line-height:1.3;">${escapeHtml(p.notes || '')}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="6" style="padding:15px;text-align:center;font-size:10px;color:#94a3b8;font-style:italic;">Sin procedimientos registrados</td></tr>';

  return `
    <div style="font-family:Helvetica,Arial,sans-serif;padding:30px;color:#1e293b;background:#ffffff;box-sizing:border-box;">
      
      <!-- HEADER -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;margin-bottom:24px;padding:20px;">
        <tr>
          <td style="padding:20px;vertical-align:middle;">
            <table style="border-collapse:collapse;">
              <tr>
                ${logoHtml ? `<td style="padding-right:16px;vertical-align:middle;">${logoHtml}</td>` : ''}
                <td style="vertical-align:middle;">
                  <h1 style="margin:0;font-size:18px;color:#0f172a;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(settings.clinicName)}</h1>
                  <p style="margin:4px 0 0;font-size:10px;color:#64748b;line-height:1.4;">
                    ${settings.clinicAddress ? escapeHtml(settings.clinicAddress) + '<br/>' : ''}
                    ${settings.clinicPhone ? '📞 ' + escapeHtml(settings.clinicPhone) : ''}${settings.clinicEmail ? '  |  ✉️ ' + escapeHtml(settings.clinicEmail) : ''}
                    ${settings.pdfShowVat && settings.clinicTaxId ? '<br/>📋 Identificación Fiscal: ' + escapeHtml(settings.clinicTaxId) : ''}
                  </p>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:20px;text-align:right;vertical-align:middle;font-size:10px;color:#64748b;line-height:1.5;width:200px;">
            <span style="background:#e0f2fe;color:#0369a1;padding:4px 10px;border-radius:20px;font-weight:600;font-size:10px;letter-spacing:0.05em;display:inline-block;margin-bottom:6px;">HISTORIAL CLÍNICO</span><br/>
            ${settings.clinicVeterinarian ? '<strong>Médico:</strong> ' + escapeHtml(settings.clinicVeterinarian) + '<br/>' : ''}
            <strong>Emitido:</strong> ${getTodayDisplay()}
          </td>
        </tr>
      </table>

      <!-- PATIENT & OWNER INFO (Table based to guarantee rendering in html2canvas) -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;margin-bottom:24px;">
        <tr>
          <!-- Patient Column -->
          <td style="width:50%;padding:16px;vertical-align:top;border-right:1px solid #f1f5f9;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:10px;">
              <tr>
                <td style="width:40px;padding-right:12px;vertical-align:middle;">
                  ${patient.photo ? `<img src="${patient.photo}" style="width:40px;height:40px;object-fit:cover;border-radius:50%;border:2px solid #e2e8f0;"/>` : `<div style="width:40px;height:40px;border-radius:50%;background:#f1f5f9;line-height:40px;text-align:center;color:#64748b;font-size:18px;">🐾</div>`}
                </td>
                <td style="vertical-align:middle;">
                  <h2 style="margin:0;font-size:15px;color:#0f172a;font-weight:600;">${fullName}</h2>
                  <span style="font-size:9px;color:#64748b;">Ficha de Paciente</span>
                </td>
              </tr>
            </table>
            <table style="width:100%;border-collapse:collapse;font-size:10px;line-height:1.5;">
              <tr><td style="padding:3px 0;color:#64748b;width:70px;">Especie:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(patient.species || '—')}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Raza:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(patient.breed || '—')}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Sexo:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(sexo)}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Edad:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${edad.join(' ') || '—'}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Peso:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${patient.weight ? escapeHtml(String(patient.weight)) + ' kg' : '—'}</td></tr>
              ${patient.microchip ? `<tr><td style="padding:3px 0;color:#64748b;">Microchip:</td><td style="padding:3px 0;font-weight:500;color:#334155;font-family:monospace;">${escapeHtml(patient.microchip)}</td></tr>` : ''}
            </table>
          </td>
          <!-- Owner Column -->
          <td style="width:50%;padding:16px;vertical-align:top;">
            <h3 style="margin:0 0 10px;font-size:12px;color:#0f172a;font-weight:600;display:block;">👤 Tutor Responsable</h3>
            <table style="width:100%;border-collapse:collapse;font-size:10px;line-height:1.5;">
              <tr><td style="padding:3px 0;color:#64748b;width:70px;">Nombre:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(patient.ownerName || '—')}</td></tr>
              <tr><td style="padding:3px 0;color:#64748b;">Teléfono:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(patient.ownerPhone || '—')}</td></tr>
              ${patient.ownerEmail ? `<tr><td style="padding:3px 0;color:#64748b;">Email:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(patient.ownerEmail)}</td></tr>` : ''}
              ${patient.ownerAddress ? `<tr><td style="padding:3px 0;color:#64748b;">Dirección:</td><td style="padding:3px 0;font-weight:500;color:#334155;">${escapeHtml(patient.ownerAddress)}</td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>

      ${patient.alerts ? `
      <div style="background:#fff1f2;border:1px solid #fecdd3;border-left:4px solid #e11d48;padding:10px 14px;margin-bottom:20px;border-radius:8px;">
        <strong style="color:#be123c;font-size:10px;font-family:'Outfit',sans-serif;letter-spacing:0.05em;display:block;margin-bottom:2px;">⚠️ ALERTAS MÉDICAS CRÍTICAS</strong>
        <p style="margin:0;font-size:10px;color:#9f1239;line-height:1.4;">${escapeHtml(patient.alerts)}</p>
      </div>` : ''}

      ${patient.notes ? `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:10px 14px;margin-bottom:20px;border-radius:8px;">
        <strong style="font-size:10px;color:#475569;font-family:'Outfit',sans-serif;display:block;margin-bottom:2px;">Notas y Observaciones Generales</strong>
        <p style="margin:0;font-size:10px;color:#334155;line-height:1.4;">${escapeHtml(patient.notes)}</p>
      </div>` : ''}

      <!-- SERVICES -->
      <div style="margin-bottom:28px;">
        <h3 style="margin:0 0 8px;font-size:13px;color:#0f172a;font-weight:600;font-family:'Outfit',sans-serif;border-bottom:2px solid #38bdf8;padding-bottom:4px;display:inline-block;">Servicios Realizados</h3>
        <table style="width:100%;border-collapse:collapse;font-size:9px;text-align:left;">
          <thead>
            <tr style="background:#f8fafc;color:#475569;border-bottom:2px solid #e2e8f0;">
              <th style="padding:8px;font-weight:600;width:70px;">Fecha</th>
              <th style="padding:8px;font-weight:600;width:120px;">Servicio</th>
              <th style="padding:8px;font-weight:600;width:100px;">Profesional</th>
              <th style="padding:8px;font-weight:600;width:100px;">Insumos / Prod.</th>
              <th style="padding:8px;font-weight:600;">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            ${servicesRows}
          </tbody>
        </table>
      </div>

      <!-- PROCEDURES -->
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 8px;font-size:13px;color:#0f172a;font-weight:600;font-family:'Outfit',sans-serif;border-bottom:2px solid #38bdf8;padding-bottom:4px;display:inline-block;">Procedimientos Realizados</h3>
        <table style="width:100%;border-collapse:collapse;font-size:9px;text-align:left;">
          <thead>
            <tr style="background:#f8fafc;color:#475569;border-bottom:2px solid #e2e8f0;">
              <th style="padding:8px;font-weight:600;width:70px;">Fecha</th>
              <th style="padding:8px;font-weight:600;width:80px;">Categoría</th>
              <th style="padding:8px;font-weight:600;width:120px;">Procedimiento</th>
              <th style="padding:8px;font-weight:600;width:100px;">Profesional</th>
              <th style="padding:8px;font-weight:600;width:100px;">Productos</th>
              <th style="padding:8px;font-weight:600;">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            ${proceduresRows}
          </tbody>
        </table>
      </div>

      <div style="margin-top:35px;padding-top:15px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;text-align:center;font-weight:500;">
        Documento generado automáticamente por ${escapeHtml(settings.clinicName || 'República Mascotas')} — ${getTodayDisplay()}
      </div>
    </div>
  `;
}

async function generatePrescriptionPDF(rxId) {
  const rx = await DB.getPrescription(rxId);
  if (!rx) throw new Error('Receta no encontrada');

  const patient = await DB.getPatient(rx.patientId);
  const settings = await DB.getClinicSettings();

  const logoHtml = (settings.clinicLogo && settings.pdfShowLogo)
    ? `<img src="${settings.clinicLogo}" style="max-height:50px;max-width:50px;object-fit:contain;"/>`
    : '';

  const medRows = (rx.medications || []).map((m, i) => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #555;font-size:10px;text-align:center;">${i+1}</td>
      <td style="padding:6px 8px;border:1px solid #555;font-size:11px;font-weight:600;">${escapeHtml(m.name)}</td>
      <td style="padding:6px 8px;border:1px solid #555;font-size:10px;">${escapeHtml(m.dose)}</td>
      <td style="padding:6px 8px;border:1px solid #555;font-size:10px;">${escapeHtml(m.frequency)}</td>
      <td style="padding:6px 8px;border:1px solid #555;font-size:10px;">${escapeHtml(m.duration)}</td>
    </tr>`).join('');

  const el = document.createElement('div');
  el.innerHTML = `
    <div style="font-family:Helvetica,Arial,sans-serif;padding:20px;color:#1a1a1a;max-width:190mm;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #00366b;padding-bottom:12px;margin-bottom:20px;">
        <div style="display:flex;align-items:center;gap:12px;">
          ${logoHtml}
          <div>
            <h1 style="margin:0;font-size:16px;color:#00366b;font-weight:700;">${escapeHtml(settings.clinicName)}</h1>
            <p style="margin:3px 0 0;font-size:9px;color:#555;">
              ${escapeHtml(settings.clinicAddress)}<br/>
              ${escapeHtml(settings.clinicPhone)}${settings.clinicEmail ? ' | ' + escapeHtml(settings.clinicEmail) : ''}
              ${settings.pdfShowVat && settings.clinicTaxId ? '<br/>VAT: ' + escapeHtml(settings.clinicTaxId) : ''}
            </p>
          </div>
        </div>
        <div style="text-align:right;font-size:10px;color:#00366b;font-weight:700;">
          RECETA MÉDICA<br/>
          <span style="font-size:9px;color:#555;font-weight:400;">N° ${escapeHtml(rx.id)}</span>
        </div>
      </div>

      <div style="display:flex;gap:20px;margin-bottom:20px;padding:12px;background:#f5f5f5;border-radius:4px;font-size:11px;">
        <div style="flex:1;">
          <strong>Paciente:</strong> ${escapeHtml(patient ? patient.name : '')}<br/>
          <strong>Especie:</strong> ${escapeHtml(patient ? patient.species : '')} | <strong>Raza:</strong> ${escapeHtml(patient ? patient.breed : '')}
        </div>
        <div style="flex:1;text-align:right;">
          <strong>Fecha:</strong> ${formatDateShort(rx.date)}<br/>
          ${rx.veterinarian ? `<strong>Veterinario:</strong> ${escapeHtml(rx.veterinarian)}` : ''}
        </div>
      </div>

      <h3 style="font-size:13px;color:#00366b;margin-bottom:8px;">Medicación Prescrita</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#00366b;color:#fff;font-size:10px;">
            <th style="padding:6px 8px;border:1px solid #00366b;text-align:center;width:30px;">#</th>
            <th style="padding:6px 8px;border:1px solid #00366b;text-align:left;">Medicamento</th>
            <th style="padding:6px 8px;border:1px solid #00366b;text-align:left;">Dosis</th>
            <th style="padding:6px 8px;border:1px solid #00366b;text-align:left;">Frecuencia</th>
            <th style="padding:6px 8px;border:1px solid #00366b;text-align:left;">Duración</th>
          </tr>
        </thead>
        <tbody>${medRows}</tbody>
      </table>

      ${rx.indications ? `
      <div style="background:#fff8e1;border:1px solid #ffe082;border-left:4px solid #f57c00;padding:8px 12px;margin-bottom:16px;border-radius:4px;">
        <strong style="font-size:10px;color:#e65100;">Indicaciones:</strong>
        <p style="margin:4px 0 0;font-size:10px;color:#333;">${escapeHtml(rx.indications)}</p>
      </div>` : ''}

      <div style="margin-top:32px;padding-top:16px;border-top:2px dashed #ccc;">
        <div style="display:flex;justify-content:space-between;font-size:9px;color:#888;">
          <div>
            <p style="margin:0 0 4px;"><strong>Firma del Veterinario</strong></p>
            <div style="width:150px;height:1px;background:#ccc;margin-top:30px;"></div>
          </div>
          <div style="text-align:right;">
            <p style="margin:0 0 4px;"><strong>Firma del Propietario</strong></p>
            <div style="width:150px;height:1px;background:#ccc;margin-top:30px;"></div>
          </div>
        </div>
      </div>

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;font-size:8px;color:#999;text-align:center;">
        Documento generado por República Mascotas — ${getTodayDisplay()}<br/>
        Este documento tiene validez únicamente con firma original del profesional.
      </div>
    </div>
  `;
  el.style.cssText = 'width:100%;max-width:794px;margin:0 auto;background:#fff;padding:0;';
  document.body.appendChild(el);

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Receta_${patient ? patient.name.replace(/\s+/g, '_') : 'medica'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false, width: 794 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'css' }
  };

  try {
    await html2pdf().set(opt).from(el).save();
  } catch (e) {
    console.error('Prescription PDF error:', e);
    alert('Error al generar el PDF. Revisá la consola para más detalles.');
  } finally {
    el.remove();
  }
}

async function generateComparisonPDF(labelA, labelB, data) {
  const settings = await DB.getClinicSettings();

  function trendPdf(valA, valB) {
    if (valB === 0 && valA === 0) return '—';
    if (valB === 0) return `+${valA} (nuevo)`;
    const diff = valA - valB;
    const pct = Math.round((diff / valB) * 100);
    if (diff > 0) return `+${pct}%`;
    if (diff < 0) return `${pct}%`;
    return '=';
  }

  function trendColor(valA, valB) {
    if (valB === 0 && valA === 0) return '#94a3b8';
    const diff = valA - valB;
    if (diff > 0) return '#16a34a';
    if (diff < 0) return '#dc2626';
    return '#94a3b8';
  }

  const metrics = [
    { label: 'Servicios', valA: data.a.services, valB: data.b.services },
    { label: 'Turnos', valA: data.a.appointments, valB: data.b.appointments },
    { label: 'Pacientes Atendidos', valA: data.a.uniquePatients, valB: data.b.uniquePatients },
    { label: 'Vacunaciones', valA: data.a.vaccinations, valB: data.b.vaccinations }
  ];

  const metricsRows = metrics.map(m => {
    const t = trendPdf(m.valA, m.valB);
    const tColor = trendColor(m.valA, m.valB);
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:500;color:#334155;">${m.label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a;text-align:center;">${m.valA}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a;text-align:center;">${m.valB}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:${tColor};text-align:center;">${t}</td>
    </tr>`;
  }).join('');

  const logoHtml = (settings.clinicLogo && settings.pdfShowLogo)
    ? `<img src="${settings.clinicLogo}" alt="Logo" style="max-height:55px;max-width:55px;object-fit:contain;border-radius:4px;"/>`
    : '';

  const el = document.createElement('div');
  el.innerHTML = `
    <div style="font-family:Helvetica,Arial,sans-serif;padding:30px;color:#1e293b;background:#ffffff;box-sizing:border-box;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;margin-bottom:28px;padding:20px;">
        <tr>
          <td style="padding:20px;vertical-align:middle;">
            <table style="border-collapse:collapse;">
              <tr>
                ${logoHtml ? `<td style="padding-right:16px;vertical-align:middle;">${logoHtml}</td>` : ''}
                <td style="vertical-align:middle;">
                  <h1 style="margin:0;font-size:18px;color:#0f172a;font-weight:700;">${escapeHtml(settings.clinicName || 'República Mascotas')}</h1>
                  <p style="margin:4px 0 0;font-size:10px;color:#64748b;line-height:1.4;">
                    ${settings.clinicAddress ? escapeHtml(settings.clinicAddress) + '<br/>' : ''}
                    ${settings.clinicPhone ? escapeHtml(settings.clinicPhone) : ''}${settings.clinicEmail ? '  |  ' + escapeHtml(settings.clinicEmail) : ''}
                  </p>
                </td>
              </tr>
            </table>
          </td>
          <td style="padding:20px;text-align:right;vertical-align:middle;font-size:10px;color:#64748b;line-height:1.5;width:200px;">
            <span style="background:#dbeafe;color:#1d4ed8;padding:4px 10px;border-radius:20px;font-weight:600;font-size:10px;letter-spacing:0.05em;display:inline-block;margin-bottom:6px;">COMPARATIVA DE MESES</span><br/>
            <strong>Emitido:</strong> ${getTodayDisplay()}
          </td>
        </tr>
      </table>
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-left:4px solid #3b82f6;padding:12px 16px;border-radius:8px;">
          <p style="margin:0;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Mes 1</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e40af;">${escapeHtml(labelA)}</p>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #22c55e;padding:12px 16px;border-radius:8px;">
          <p style="margin:0;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Mes 2</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#166534;">${escapeHtml(labelB)}</p>
        </div>
      </div>
      <h3 style="margin:0 0 10px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:2px solid #3b82f6;padding-bottom:4px;display:inline-block;">Resumen Comparativo</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;">Métrica</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:center;">${escapeHtml(labelA)}</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:center;">${escapeHtml(labelB)}</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:center;">Tendencia</th>
          </tr>
        </thead>
        <tbody>${metricsRows}</tbody>
      </table>
      <h3 style="margin:0 0 10px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:2px solid #3b82f6;padding-bottom:4px;display:inline-block;">Destacados por Mes</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:left;">Categoría</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:center;">${escapeHtml(labelA)}</th>
            <th style="padding:10px 12px;font-size:10px;font-weight:600;color:#475569;text-align:center;">${escapeHtml(labelB)}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:500;color:#334155;">Servicio más frecuente</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(data.a.topServiceType)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(data.b.topServiceType)}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:500;color:#334155;">Profesional destacado</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(data.a.topProfessional)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:600;color:#0f172a;text-align:center;">${escapeHtml(data.b.topProfessional)}</td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:35px;padding-top:15px;border-top:1px solid #e2e8f0;font-size:8px;color:#94a3b8;text-align:center;font-weight:500;">
        Documento generado automáticamente por ${escapeHtml(settings.clinicName || 'República Mascotas')} — ${getTodayDisplay()}
      </div>
    </div>
  `;
  el.style.cssText = 'width:100%;max-width:794px;margin:0 auto;background:#fff;padding:0;';
  document.body.appendChild(el);

  const opt = {
    margin: [8, 8, 8, 8],
    filename: `Comparativa_${labelA.replace(/\s+/g, '_')}_vs_${labelB.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, allowTaint: true, logging: false, width: 794 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'css' }
  };

  try {
    await html2pdf().set(opt).from(el).save();
  } catch (e) {
    console.error('Comparison PDF error:', e);
    alert('Error al generar el PDF. Revisá la consola para más detalles.');
  } finally {
    el.remove();
  }
}
