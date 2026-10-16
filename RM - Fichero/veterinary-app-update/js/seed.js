async function seedMockData() {
  if (!confirm('¿Cargar datos de ejemplo? Se eliminarán todos los datos actuales.')) return;

  const seedBtn = document.getElementById('btn-seed');
  if (seedBtn) { seedBtn.disabled = true; seedBtn.textContent = 'Cargando...'; }

  try {
    await DB.clearAll();

    await DB.saveSetting('clinicName', 'República Mascota');
    await DB.saveSetting('clinicAddress', 'Av. Siempre Viva 742, Montevideo');
    await DB.saveSetting('clinicPhone', '099 123 456');
    await DB.saveSetting('clinicEmail', 'contacto@republicamascota.uy');
    await DB.saveSetting('clinicTaxId', '210123450018');
    await DB.saveSetting('clinicVeterinarian', 'Dr. Martín López');
    await DB.saveSetting('procedureCategories', {
      Baño: ['Baño Medicado', 'Corte de Uñas', 'Limpieza de Oídos'],
      Control: ['Control de Peso', 'Revisión General', 'Control Postquirúrgico'],
      Vacunas: ['Rabia', 'Quíntuple', 'Moquillo', 'Parvovirus'],
      Pipetas: ['Frontline', 'Advantix', 'Revolution', 'Stronghold']
    });

    let _idCounter = 0;
    function _seedId(prefix) {
      _idCounter++;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let r = '';
      for (let i = 0; i < 4; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
      return prefix + '-' + (Date.now() + _idCounter).toString(36).toUpperCase() + '-' + r;
    }

    const patients = [
      { name: 'Luna', lastName: 'García', species: 'Perro', breed: 'Labrador Retriever', sex: 'Hembra', neutered: true, ageYears: 3, ageMonths: 2, weight: 28.5, color: 'Dorado', microchip: 'ABC123456', marks: 'Mancha blanca en el pecho', ownerName: 'María García', ownerPhone: '099111222', ownerEmail: 'maria@email.com', ownerAddress: 'Calle 1, Montevideo', photo: '', alerts: 'Alérgica a las pulgas', notes: 'Muy activa y cariñosa', createdAt: '2025-06-01', updatedAt: '2025-06-01' },
      { name: 'Simba', lastName: 'Rodríguez', species: 'Gato', breed: 'Siamés', sex: 'Macho', neutered: true, ageYears: 5, ageMonths: 0, weight: 4.2, color: 'Crema oscuro', microchip: 'DEF789012', marks: '', ownerName: 'Pedro Rodríguez', ownerPhone: '099333444', ownerEmail: 'pedro@email.com', ownerAddress: 'Av. 18 de Julio 123', photo: '', alerts: 'Requiere dieta baja en calorías', notes: 'Gato tímido pero dulce una vez que confía', createdAt: '2025-06-15', updatedAt: '2025-06-15' },
      { name: 'Rocky', lastName: 'Fernández', species: 'Perro', breed: 'Bulldog Francés', sex: 'Macho', neutered: false, ageYears: 1, ageMonths: 8, weight: 12.0, color: 'Atigrado', microchip: 'GHI345678', marks: 'Nariz rosada', ownerName: 'Ana Fernández', ownerPhone: '099555666', ownerEmail: 'ana@email.com', ownerAddress: 'Calle 5, 1234', photo: '', alerts: 'Propenso a dermatitis en pliegues', notes: 'Ronca fuerte cuando duerme', createdAt: '2026-01-10', updatedAt: '2026-01-10' },
      { name: 'Piolín', lastName: 'López', species: 'Ave', breed: 'Periquito', sex: 'Macho', neutered: false, ageYears: 2, ageMonths: 0, weight: 0.035, color: 'Verde y amarillo', microchip: '', marks: '', ownerName: 'Sofía López', ownerPhone: '099777888', ownerEmail: 'sofia@email.com', ownerAddress: 'Calle 8, 567', photo: '', alerts: '', notes: 'Silba la canción de Harry Potter', createdAt: '2026-03-05', updatedAt: '2026-03-05' },
      { name: 'Copito', lastName: 'Pérez', species: 'Conejo', breed: 'Mini Lop', sex: 'Hembra', neutered: true, ageYears: 4, ageMonths: 6, weight: 1.8, color: 'Blanco', microchip: '', marks: 'Oreja izquierda caída', ownerName: 'Carlos Pérez', ownerPhone: '099999000', ownerEmail: 'carlos@email.com', ownerAddress: 'Av. Italia 987', photo: '', alerts: 'Dentadura irregular, revisar mensualmente', notes: 'Le encanta la zanahoria y el perejil', createdAt: '2025-09-20', updatedAt: '2025-09-20' }
    ];

    const patientIds = [];
    for (const p of patients) {
      p.id = _seedId('PAC');
      patientIds.push(p.id);
      await DB.addPatient(p);
    }

    const products = [
      { id: _seedId('PRD'), name: 'Frontline Plus', barcode: '7791234560011', category: 'Pipetas', stock: 15, minStock: 5, price: 850 },
      { id: _seedId('PRD'), name: 'Advantix', barcode: '7791234560028', category: 'Pipetas', stock: 10, minStock: 3, price: 920 },
      { id: _seedId('PRD'), name: 'Revolution', barcode: '7791234560035', category: 'Pipetas', stock: 8, minStock: 3, price: 1100 },
      { id: _seedId('PRD'), name: 'Alimento Royal Canin Perro Adulto 15kg', barcode: '7791234560042', category: 'Alimento', stock: 5, minStock: 2, price: 3200 },
      { id: _seedId('PRD'), name: "Alimento Hill's gato Adulto 7kg", barcode: '7791234560059', category: 'Alimento', stock: 4, minStock: 2, price: 2800 },
      { id: _seedId('PRD'), name: 'Antipulgas NexGard', barcode: '7791234560066', category: 'Antiparasitarios', stock: 20, minStock: 5, price: 1300 },
      { id: _seedId('PRD'), name: 'Shampoo Medicado DermaPet', barcode: '', category: 'Higiene', stock: 7, minStock: 3, price: 650 },
      { id: _seedId('PRD'), name: 'Collar Isabelino Talle M', barcode: '', category: 'Accesorios', stock: 12, minStock: 5, price: 450 },
      { id: _seedId('PRD'), name: 'Vacuna Quíntuple', barcode: '', category: 'Vacunas', stock: 25, minStock: 10, price: 0 },
      { id: _seedId('PRD'), name: 'Vacuna Rabia', barcode: '', category: 'Vacunas', stock: 30, minStock: 10, price: 0 }
    ];
    for (const pr of products) {
      await DB.addProduct(pr);
    }

    for (let i = 0; i < 3; i++) {
      const svcId = _seedId('SVC');
      await DB.addService({
        id: svcId, patientId: patientIds[0], serviceType: 'Consulta General', performedBy: 'Dr. Martín López',
        date: '2026-05-' + String(10 + i).padStart(2, '0'), time: '10:30', notes: 'Control de rutina. Sin novedades.',
        createdAt: '2026-05-' + String(10 + i).padStart(2, '0')
      });
    }
    await DB.addService({
      id: _seedId('SVC'), patientId: patientIds[0], serviceType: 'Baño Medicado', performedBy: 'Martina (Bañera)',
      date: '2026-05-20', time: '14:00', notes: 'Baño medicado con DermaPet shampoo.\n[Insumo utilizado: Shampoo Medicado DermaPet x1]',
      createdAt: '2026-05-20'
    });
    await DB.addService({
      id: _seedId('SVC'), patientId: patientIds[1], serviceType: 'Vacunación', performedBy: 'Dr. Martín López',
      date: '2026-05-18', time: '11:00', notes: 'Vacuna Quíntuple aplicada. Sin reacciones adversas.\n[Insumo utilizado: Vacuna Quíntuple x1]',
      createdAt: '2026-05-18'
    });
    await DB.addService({
      id: _seedId('SVC'), patientId: patientIds[2], serviceType: 'Control de Peso', performedBy: 'Dr. Martín López',
      date: '2026-05-25', time: '09:15', notes: 'Peso estable en 12kg. Continuar con dieta balanceada.',
      createdAt: '2026-05-25'
    });
    await DB.addService({
      id: _seedId('SVC'), patientId: patientIds[4], serviceType: 'Corte de Uñas', performedBy: 'Martina (Bañera)',
      date: '2026-06-01', time: '16:00', notes: 'Corte de uñas y revisión dental.',
      createdAt: '2026-06-01'
    });

    for (let i = 0; i < 3; i++) {
      await DB.addPatientProcedure({
        id: _seedId('PP'), patientId: patientIds[0], category: 'Baño', procedureName: 'Baño Medicado',
        date: '2026-05-' + String(15 + i).padStart(2, '0'), performedBy: 'Martina',
        nextDate: '2026-06-' + String(15 + i).padStart(2, '0'), notes: 'Baño medicado semanal.',
        createdAt: '2026-05-' + String(15 + i).padStart(2, '0')
      });
    }
    await DB.addPatientProcedure({
      id: _seedId('PP'), patientId: patientIds[1], category: 'Vacunas', procedureName: 'Rabia',
      date: '2026-05-18', performedBy: 'Dr. Martín López',
      nextDate: '2027-05-18', notes: 'Primera dosis de vacuna antirrábica.',
      createdAt: '2026-05-18'
    });
    await DB.addPatientProcedure({
      id: _seedId('PP'), patientId: patientIds[0], category: 'Pipetas', procedureName: 'Frontline',
      date: '2026-05-01', performedBy: 'María García (dueña)',
      nextDate: '2026-06-01', notes: 'Aplicación mensual de Frontline Plus.\n[Insumo utilizado: Frontline Plus x1]',
      createdAt: '2026-05-01'
    });
    await DB.addPatientProcedure({
      id: _seedId('PP'), patientId: patientIds[2], category: 'Control', procedureName: 'Revisión General',
      date: '2026-05-25', performedBy: 'Dr. Martín López',
      nextDate: '', notes: 'Revisión general sin novedades. Próxima revisión en 3 meses.',
      createdAt: '2026-05-25'
    });
    await DB.addPatientProcedure({
      id: _seedId('PP'), patientId: patientIds[2], category: 'Vacunas', procedureName: 'Quíntuple',
      date: '2026-01-15', performedBy: 'Dr. Martín López',
      nextDate: '2027-01-15', notes: 'Refuerzo de vacuna quíntuple.',
      createdAt: '2026-01-15'
    });
    await DB.addPatientProcedure({
      id: _seedId('PP'), patientId: patientIds[3], category: 'Control', procedureName: 'Revisión General',
      date: '2026-03-05', performedBy: 'Dr. Martín López',
      nextDate: '2027-03-05', notes: 'Revisión anual. Ave en buen estado general.',
      createdAt: '2026-03-05'
    });
    await DB.addPatientProcedure({
      id: _seedId('PP'), patientId: patientIds[4], category: 'Control', procedureName: 'Revisión General',
      date: '2026-04-10', performedBy: 'Dr. Martín López',
      nextDate: '2026-07-10', notes: 'Revisión dental mensual recomendada. Se programó próxima revisión.',
      createdAt: '2026-04-10'
    });

    await DB.addAppointment({
      id: _seedId('APT'), patientId: patientIds[0], date: getToday(), time: '10:00',
      reason: 'Control de alergia estacional', notes: 'Traer resultados de análisis anteriores.',
      createdAt: getToday()
    });
    await DB.addAppointment({
      id: _seedId('APT'), patientId: patientIds[2], date: getToday(), time: '11:30',
      reason: 'Revisión de dermatitis', notes: '',
      createdAt: getToday()
    });
    await DB.addAppointment({
      id: _seedId('APT'), patientId: patientIds[4], date: getToday(), time: '15:00',
      reason: 'Corte de uñas + control dental', notes: 'Recordar traer zanahorias para premiar :)',
      createdAt: getToday()
    });

    if (seedBtn) { seedBtn.disabled = false; seedBtn.textContent = 'Cargar datos de ejemplo'; }

    if (typeof App !== 'undefined') {
      App.navigate('patients');
    }

    alert('Datos de ejemplo cargados correctamente.\n5 pacientes, 7 servicios, 8 procedimientos, 10 productos, 3 turnos.');
  } catch (e) {
    console.error('Seed error:', e);
    alert('Error al cargar datos de ejemplo: ' + e.message);
    if (seedBtn) { seedBtn.disabled = false; seedBtn.textContent = 'Cargar datos de ejemplo'; }
  }
}
