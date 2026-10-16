const DB_NAME = 'VetCareProDB';
const DB_VERSION = 5;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('patients')) {
        const store = db.createObjectStore('patients', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('ownerName', 'ownerName', { unique: false });
        store.createIndex('species', 'species', { unique: false });
      }
      if (!db.objectStoreNames.contains('services')) {
        const store = db.createObjectStore('services', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('appointments')) {
        const store = db.createObjectStore('appointments', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('vaccinations')) {
        const store = db.createObjectStore('vaccinations', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
        store.createIndex('nextDoseDate', 'nextDoseDate', { unique: false });
      }
      if (!db.objectStoreNames.contains('prescriptions')) {
        const store = db.createObjectStore('prescriptions', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('inventory')) {
        const store = db.createObjectStore('inventory', { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('patientProcedures')) {
        const store = db.createObjectStore('patientProcedures', { keyPath: 'id' });
        store.createIndex('patientId', 'patientId', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('nextDate', 'nextDate', { unique: false });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbOperation(storeName, mode, callback) {
  return new Promise((resolve, reject) => {
    openDB().then(db => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const result = callback(store);
      tx.oncomplete = () => {
        resolve(result);
        db.close();
      };
      tx.onerror = (e) => {
        reject(e.target.error);
        db.close();
      };
    }).catch(reject);
  });
}

const DB = {
  // ---- SETTINGS ----
  async saveSetting(key, value) {
    return dbOperation('settings', 'readwrite', store => {
      store.put({ key, value });
    });
  },
  async getSetting(key) {
    return dbOperation('settings', 'readonly', store => {
      const req = store.get(key);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllSettings() {
    return dbOperation('settings', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const obj = {};
          req.result.forEach(item => { obj[item.key] = item.value; });
          resolve(obj);
        };
        req.onerror = () => reject(req.error);
      });
    });
  },
  async saveClinicSettings(data) {
    const entries = {
      clinicName: data.clinicName || '',
      clinicEmail: data.clinicEmail || '',
      clinicAddress: data.clinicAddress || '',
      clinicPhone: data.clinicPhone || '',
      clinicTaxId: data.clinicTaxId || '',
      clinicLogo: data.clinicLogo || '',
      clinicVeterinarian: data.clinicVeterinarian || '',
      pdfShowLogo: data.pdfShowLogo !== undefined ? data.pdfShowLogo : true,
      pdfShowVat: data.pdfShowVat !== undefined ? data.pdfShowVat : true,
      themePrimary: data.themePrimary || '#00366b',
      themeSecondary: data.themeSecondary || '#006a63',
      themeDarkMode: data.themeDarkMode || false
    };
    return dbOperation('settings', 'readwrite', store => {
      for (const [key, value] of Object.entries(entries)) {
        store.put({ key, value });
      }
    });
  },
  async getClinicSettings() {
    const all = await this.getAllSettings();
    return {
      clinicName: all.clinicName || 'República Mascota',
      clinicEmail: all.clinicEmail || '',
      clinicAddress: all.clinicAddress || '',
      clinicPhone: all.clinicPhone || '',
      clinicTaxId: all.clinicTaxId || '',
      clinicLogo: all.clinicLogo || 'assets/logo.jfif',
      clinicVeterinarian: all.clinicVeterinarian || '',
      pdfShowLogo: all.pdfShowLogo !== false,
      pdfShowVat: all.pdfShowVat !== false,
      themePrimary: all.themePrimary || '#005da7',
      themeSecondary: all.themeSecondary || '#775a00',
      themeDarkMode: all.themeDarkMode || false
    };
  },
  async getLastBackupDate() {
    const val = await this.getSetting('lastBackupDate');
    return val || null;
  },
  async setLastBackupDate(date) {
    return this.saveSetting('lastBackupDate', date);
  },

  // ---- PATIENTS ----
  async addPatient(patient) {
    return dbOperation('patients', 'readwrite', store => {
      const req = store.put(patient);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(patient);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async updatePatient(patient) {
    return this.addPatient(patient);
  },
  async deletePatient(id) {
    const relatedStores = {
      'services': 'patientId',
      'appointments': 'patientId',
      'vaccinations': 'patientId',
      'prescriptions': 'patientId',
      'patientProcedures': 'patientId'
    };
    for (const [storeName, indexName] of Object.entries(relatedStores)) {
      await dbOperation(storeName, 'readwrite', store => {
        const req = store.index(indexName).getAll(id);
        return new Promise((resolve, reject) => {
          req.onsuccess = () => {
            const records = req.result || [];
            if (records.length === 0) return resolve();
            let deleted = 0;
            for (const rec of records) {
              const delReq = store.delete(rec.id);
              delReq.onsuccess = () => { deleted++; if (deleted >= records.length) resolve(); };
              delReq.onerror = () => reject(delReq.error);
            }
          };
          req.onerror = () => reject(req.error);
        });
      });
    }
    return dbOperation('patients', 'readwrite', store => {
      const req = store.delete(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getPatient(id) {
    return dbOperation('patients', 'readonly', store => {
      const req = store.get(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllPatients() {
    return dbOperation('patients', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async searchPatients(query) {
    const patients = await this.getAllPatients();
    if (!query) return patients;
    const q = query.toLowerCase();
    return patients.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.lastName || '').toLowerCase().includes(q) ||
      `${(p.name || '').toLowerCase()} ${(p.lastName || '').toLowerCase()}`.includes(q) ||
      (p.ownerName || '').toLowerCase().includes(q) ||
      (p.species || '').toLowerCase().includes(q) ||
      (p.breed || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q) ||
      (p.ownerPhone || '').includes(q)
    );
  },

  // ---- SERVICES ----
  async addService(service) {
    return dbOperation('services', 'readwrite', store => {
      const req = store.put(service);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(service);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async updateService(service) {
    return this.addService(service);
  },
  async deleteService(id) {
    return dbOperation('services', 'readwrite', store => {
      const req = store.delete(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getService(id) {
    return dbOperation('services', 'readonly', store => {
      const req = store.get(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getServicesByPatient(patientId) {
    return dbOperation('services', 'readonly', store => {
      const req = store.index('patientId').getAll(patientId);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllServices() {
    return dbOperation('services', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getRecentServices(limit = 10) {
    const services = await this.getAllServices();
    services.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    return services.slice(0, limit);
  },
  async getServicesByDateRange(startDate, endDate) {
    const services = await this.getAllServices();
    return services.filter(s => s.date >= startDate && s.date <= endDate);
  },

  async getComparisonData(yearA, monthA, yearB, monthB) {
    const rangeA = getMonthRangeFor(yearA, monthA);
    const rangeB = getMonthRangeFor(yearB, monthB);

    const [allServices, allAppointments, allVaccinations, allPatients] = await Promise.all([
      this.getAllServices(),
      this.getAllAppointments(),
      this.getAllVaccinations(),
      this.getAllPatients()
    ]);

    function computeMetrics(services, appointments, vaccinations) {
      const uniquePatientIds = new Set(services.map(s => s.patientId).filter(Boolean));
      const serviceTypeCounts = {};
      services.forEach(s => {
        serviceTypeCounts[s.serviceType] = (serviceTypeCounts[s.serviceType] || 0) + 1;
      });
      const topServiceType = Object.entries(serviceTypeCounts).sort((a, b) => b[1] - a[1])[0] || null;

      const performerCounts = {};
      services.forEach(s => {
        if (s.performedBy) performerCounts[s.performedBy] = (performerCounts[s.performedBy] || 0) + 1;
      });
      const topProfessional = Object.entries(performerCounts).sort((a, b) => b[1] - a[1])[0] || null;

      return {
        services: services.length,
        appointments: appointments.length,
        uniquePatients: uniquePatientIds.size,
        vaccinations: vaccinations.length,
        topServiceType: topServiceType ? topServiceType[0] : '—',
        topProfessional: topProfessional ? topProfessional[0] : '—'
      };
    }

    const servicesA = allServices.filter(s => s.date >= rangeA.start && s.date <= rangeA.end);
    const servicesB = allServices.filter(s => s.date >= rangeB.start && s.date <= rangeB.end);
    const appointmentsA = allAppointments.filter(a => a.date >= rangeA.start && a.date <= rangeA.end);
    const appointmentsB = allAppointments.filter(a => a.date >= rangeB.start && a.date <= rangeB.end);
    const vaccinationsA = allVaccinations.filter(v => v.dateApplied >= rangeA.start && v.dateApplied <= rangeA.end);
    const vaccinationsB = allVaccinations.filter(v => v.dateApplied >= rangeB.start && v.dateApplied <= rangeB.end);

    const metricsA = computeMetrics(servicesA, appointmentsA, vaccinationsA);
    const metricsB = computeMetrics(servicesB, appointmentsB, vaccinationsB);

    return { a: metricsA, b: metricsB };
  },

  // ---- APPOINTMENTS ----
  async addAppointment(appointment) {
    return dbOperation('appointments', 'readwrite', store => {
      const req = store.put(appointment);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(appointment);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async deleteAppointment(id) {
    return dbOperation('appointments', 'readwrite', store => {
      const req = store.delete(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAppointmentsByDate(date) {
    return dbOperation('appointments', 'readonly', store => {
      const req = store.index('date').getAll(date);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAppointmentsByPatient(patientId) {
    return dbOperation('appointments', 'readonly', store => {
      const req = store.index('patientId').getAll(patientId);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllAppointments() {
    return dbOperation('appointments', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },

  async updateAppointment(id, data) {
    return dbOperation('appointments', 'readwrite', store => {
      const req = store.get(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => {
          const existing = req.result;
          if (!existing) { reject(new Error('Appointment not found')); return; }
          Object.assign(existing, data);
          store.put(existing).onsuccess = () => resolve(existing);
        };
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAppointmentsByRange(startDate, endDate) {
    const all = await this.getAllAppointments();
    return all.filter(a => a.date >= startDate && a.date <= endDate);
  },

  // ---- VACCINATIONS ----
  async addVaccination(vac) {
    return dbOperation('vaccinations', 'readwrite', store => {
      return new Promise((resolve, reject) => {
        const req = store.put(vac);
        req.onsuccess = () => resolve(vac);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getVaccinationsByPatient(patientId) {
    return dbOperation('vaccinations', 'readonly', store => {
      const req = store.index('patientId').getAll(patientId);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllVaccinations() {
    return dbOperation('vaccinations', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getVaccinationsDueSoon(daysAhead = 30) {
    const all = await this.getAllVaccinations();
    const today = getToday();
    const limit = new Date();
    limit.setDate(limit.getDate() + daysAhead);
    const limitStr = formatDateInput(limit);
    return all.filter(v => v.nextDoseDate && v.nextDoseDate >= today && v.nextDoseDate <= limitStr);
  },
  async getVaccinationsOverdue() {
    const all = await this.getAllVaccinations();
    const today = getToday();
    return all.filter(v => v.nextDoseDate && v.nextDoseDate < today);
  },
  async deleteVaccination(id) {
    return dbOperation('vaccinations', 'readwrite', store => {
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },

  // ---- PRESCRIPTIONS ----
  async addPrescription(rx) {
    return dbOperation('prescriptions', 'readwrite', store => {
      return new Promise((resolve, reject) => {
        const req = store.put(rx);
        req.onsuccess = () => resolve(rx);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getPrescriptionsByPatient(patientId) {
    return dbOperation('prescriptions', 'readonly', store => {
      const req = store.index('patientId').getAll(patientId);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve((req.result || []).sort((a,b) => b.date.localeCompare(a.date)));
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getPrescription(id) {
    return dbOperation('prescriptions', 'readonly', store => {
      const req = store.get(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async deletePrescription(id) {
    return dbOperation('prescriptions', 'readwrite', store => {
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllPrescriptions() {
    return dbOperation('prescriptions', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },

  // ---- INVENTORY ----
  async addProduct(product) {
    return dbOperation('inventory', 'readwrite', store => {
      const req = store.put(product);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(product);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async updateProduct(product) {
    return this.addProduct(product);
  },
  async deleteProduct(id) {
    return dbOperation('inventory', 'readwrite', store => {
      const req = store.delete(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getProduct(id) {
    return dbOperation('inventory', 'readonly', store => {
      const req = store.get(id);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllProducts() {
    return dbOperation('inventory', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getProductByBarcode(barcode) {
    const all = await this.getAllProducts();
    return all.find(p => p.barcode === barcode) || null;
  },

  // ---- DASHBOARD STATS ----
  async getDashboardStats() {
    const patients = await this.getAllPatients();
    const services = await this.getAllServices();
    const appointments = await this.getAllAppointments();
    const today = getToday();

    const todayAppointments = appointments.filter(a => a.date === today);
    const todayServices = services.filter(s => s.date === today);
    const weekRange = getWeekRange();
    const weekServices = services.filter(s => s.date >= weekRange.start && s.date <= weekRange.end);
    const monthRange = getMonthRange();
    const monthServices = services.filter(s => s.date >= monthRange.start && s.date <= monthRange.end);

    return {
      totalPatients: patients.length,
      totalServices: services.length,
      todayAppointments: todayAppointments.length,
      todayServices: todayServices.length,
      weekServices: weekServices.length,
      monthServices: monthServices.length,
      totalAppointments: appointments.length
    };
  },

  // ---- PROCEDURE CATEGORIES (Settings) ----
  async getProcedureCategories() {
    const val = await this.getSetting('procedureCategories');
    return val || { Baño: [], Control: [], Vacunas: [], Pipetas: [] };
  },
  async saveProcedureCategories(data) {
    return this.saveSetting('procedureCategories', data);
  },

  // ---- PATIENT PROCEDURES ----
  async addPatientProcedure(pp) {
    return dbOperation('patientProcedures', 'readwrite', store => {
      return new Promise((resolve, reject) => {
        const req = store.put(pp);
        req.onsuccess = () => resolve(pp);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getPatientProceduresByPatient(patientId) {
    return dbOperation('patientProcedures', 'readonly', store => {
      const req = store.index('patientId').getAll(patientId);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getAllPatientProcedures() {
    return dbOperation('patientProcedures', 'readonly', store => {
      const req = store.getAll();
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getPatientProceduresByCategory(category) {
    return dbOperation('patientProcedures', 'readonly', store => {
      const req = store.index('category').getAll(category);
      return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    });
  },
  async deletePatientProcedure(id) {
    return dbOperation('patientProcedures', 'readwrite', store => {
      return new Promise((resolve, reject) => {
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    });
  },
  async getPatientProceduresDueSoon(daysAhead = 30) {
    const all = await this.getAllPatientProcedures();
    const today = getToday();
    const limit = new Date();
    limit.setDate(limit.getDate() + daysAhead);
    const limitStr = formatDateInput(limit);
    return all.filter(p =>
      (p.category === 'Vacunas' || p.category === 'Pipetas') &&
      p.nextDate && p.nextDate >= today && p.nextDate <= limitStr
    );
  },
  async getPatientProceduresOverdue() {
    const all = await this.getAllPatientProcedures();
    const today = getToday();
    return all.filter(p =>
      (p.category === 'Vacunas' || p.category === 'Pipetas') &&
      p.nextDate && p.nextDate < today
    );
  },

  // ---- BACKUP ----
  async exportAllData() {
    const patients = await this.getAllPatients();
    const services = await this.getAllServices();
    const appointments = await this.getAllAppointments();
    const vaccinations = await this.getAllVaccinations();
    const prescriptions = await this.getAllPrescriptions();
    const products = await this.getAllProducts();
    const patientProcedures = await this.getAllPatientProcedures();
    const settings = await this.getAllSettings();
    return {
      version: 5,
      exportedAt: new Date().toISOString(),
      data: { patients, services, appointments, vaccinations, prescriptions, products, settings, patientProcedures }
    };
  },
  async importAllData(backup) {
    if (!backup || !backup.data) throw new Error('Formato de backup inválido');
    const { patients, services, appointments, vaccinations, prescriptions, products, settings, patientProcedures } = backup.data;

    if (patients && patients.length > 0) {
      for (const p of patients) await this.addPatient(p);
    }
    if (services && services.length > 0) {
      for (const s of services) await this.addService(s);
    }
    if (appointments && appointments.length > 0) {
      for (const a of appointments) await this.addAppointment(a);
    }
    if (vaccinations && vaccinations.length > 0) {
      for (const v of vaccinations) await this.addVaccination(v);
    }
    if (prescriptions && prescriptions.length > 0) {
      for (const rx of prescriptions) await this.addPrescription(rx);
    }
    if (products && products.length > 0) {
      for (const pr of products) await this.addProduct(pr);
    }
    if (patientProcedures && patientProcedures.length > 0) {
      for (const pp of patientProcedures) await this.addPatientProcedure(pp);
    }
    if (settings) {
      for (const key of Object.keys(settings)) {
        if (key !== 'lastBackupDate') {
          await this.saveSetting(key, settings[key]);
        }
      }
    }
    await this.setLastBackupDate(getToday());
    return { patients: patients?.length || 0, services: services?.length || 0, appointments: appointments?.length || 0, vaccinations: vaccinations?.length || 0, prescriptions: prescriptions?.length || 0, products: products?.length || 0, patientProcedures: patientProcedures?.length || 0 };
  },

  // ---- CLEAR ALL ----
  async clearAll() {
    return new Promise((resolve, reject) => {
      openDB().then(db => {
        const stores = ['settings', 'patients', 'services', 'appointments', 'vaccinations', 'prescriptions', 'inventory', 'patientProcedures'];
        const tx = db.transaction(stores, 'readwrite');
        stores.forEach(s => tx.objectStore(s).clear());
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = (e) => { db.close(); reject(e.target.error); };
      }).catch(reject);
    });
  }
};
