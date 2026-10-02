/**
 * InvoicePro — Mobile-First Production Invoice Generator
 * Vanilla ES6 | All logic in browser | LocalStorage auto-save
 */

const today = new Date().toISOString().split('T')[0];

const defaultPreferences = {
  currency: 'IDR',
  status: 'draft',
  taxRate: 0,
  dueDays: 14
};

const defaultState = {
  business: {
    name: '',
    address: '',
    email: '',
    phone: '',
    logo: ''
  },
  invoice: {
    number: '',
    date: today,
    dueDate: '',
    currency: 'IDR',
    status: 'draft'
  },
  customer: {
    name: '',
    company: '',
    address: '',
    email: '',
    phone: ''
  },
  items: [],
  calculations: {
    discountType: 'percent',
    discountValue: 0,
    taxRate: 0,
    paymentUrl: ''
  },
  notes: '',
  paymentTerms: '',
  signature: '',
  theme: 'light'
};

class InvoiceApp {
  clearDemoDataIfPresent() {
    const raw = localStorage.getItem('invoicepro_state');
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      const demoMarkers = [
        saved?.business?.name === 'PT Solusi Digital Nusantara',
        saved?.customer?.name === 'Budi Santoso',
        saved?.calculations?.paymentUrl === 'https://pay.solusidigital.id/inv-001'
      ];
      if (demoMarkers.some(Boolean)) localStorage.removeItem('invoicepro_state');
    } catch {
      localStorage.removeItem('invoicepro_state');
    }
  }

  constructor() {
    this.clearDemoDataIfPresent();
    this.preferences = this.loadPreferences();
    this.businessProfile = this.loadBusinessProfile();
    this.state = this.loadState();
    this.ensureInvoiceNumber();
    this.initElements();
    this.initEventListeners();
    this.populateForm();
    this.renderItemsList();
    this.applyTheme();
    this.renderPreview();
    this.populateProfilePreferences();
    this.updateDiscountPrefix();
    this.initIcons();
  }

  // Storage
  loadState() {
    try {
      const saved = localStorage.getItem('invoicepro_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultState,
          ...parsed,
          business: { ...defaultState.business, ...(parsed.business || {}) },
          invoice: { ...defaultState.invoice, ...(parsed.invoice || {}) },
          customer: { ...defaultState.customer, ...(parsed.customer || {}) },
          calculations: { ...defaultState.calculations, ...(parsed.calculations || {}) },
          items: Array.isArray(parsed.items) && parsed.items.length ? parsed.items : defaultState.items
        };
      }
    } catch (e) { console.warn('Gagal load LocalStorage', e); }
    return JSON.parse(JSON.stringify(defaultState));
  }

  saveState() {
    try { localStorage.setItem('invoicepro_state', JSON.stringify(this.state)); } catch (e) {}
  }

  loadPreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem('invoicepro_preferences') || 'null');
      return { ...defaultPreferences, ...(saved || {}) };
    } catch (e) {
      return { ...defaultPreferences };
    }
  }

  savePreferences() {
    try {
      localStorage.setItem('invoicepro_preferences', JSON.stringify(this.preferences));
    } catch (e) {}
  }

  loadBusinessProfile() {
    try {
      const saved = JSON.parse(localStorage.getItem('invoicepro_business_profile') || 'null');
      return {
        name: '', address: '', email: '', phone: '',
        ...(saved || {})
      };
    } catch (e) {
      return { name: '', address: '', email: '', phone: '' };
    }
  }

  saveBusinessProfile() {
    try {
      localStorage.setItem('invoicepro_business_profile', JSON.stringify(this.businessProfile));
    } catch (e) {}
  }

  populateProfilePreferences() {
    this.setVal('profileBusinessName', this.businessProfile.name);
    this.setVal('profileBusinessAddress', this.businessProfile.address);
    this.setVal('profileBusinessEmail', this.businessProfile.email);
    this.setVal('profileBusinessPhone', this.businessProfile.phone);
    this.setVal('prefCurrency', this.preferences.currency);
    this.setVal('prefStatus', this.preferences.status);
    this.setVal('prefTaxRate', this.preferences.taxRate);
    this.setVal('prefDueDays', this.preferences.dueDays);
    this.updateProfileThemeLabel();
  }

  readBusinessProfileForm() {
    return {
      name: document.getElementById('profileBusinessName')?.value.trim() || '',
      address: document.getElementById('profileBusinessAddress')?.value.trim() || '',
      email: document.getElementById('profileBusinessEmail')?.value.trim() || '',
      phone: document.getElementById('profileBusinessPhone')?.value.trim() || ''
    };
  }

  readPreferencesForm() {
    let taxRate = Number(document.getElementById('prefTaxRate')?.value);
    let dueDays = Number(document.getElementById('prefDueDays')?.value);
    if (!Number.isFinite(taxRate)) taxRate = 0;
    if (!Number.isFinite(dueDays)) dueDays = 14;
    return {
      currency: document.getElementById('prefCurrency')?.value || 'IDR',
      status: document.getElementById('prefStatus')?.value || 'draft',
      taxRate: Math.min(100, Math.max(0, taxRate)),
      dueDays: Math.min(3650, Math.max(0, Math.round(dueDays)))
    };
  }

  applyBusinessProfile() {
    this.state.business = { ...this.state.business, ...this.readBusinessProfileForm() };
    this.saveState();
    this.populateForm();
    this.renderPreview();
    this.showToast('Profil bisnis diterapkan ke invoice ini', 'success');
  }

  applyPreferences() {
    const prefs = this.readPreferencesForm();
    this.preferences = prefs;
    this.savePreferences();
    this.state.invoice.currency = prefs.currency;
    this.state.invoice.status = prefs.status;
    this.state.calculations.taxRate = prefs.taxRate;
    if (this.state.invoice.date && prefs.dueDays >= 0) {
      const date = new Date(this.state.invoice.date + 'T00:00:00');
      date.setDate(date.getDate() + prefs.dueDays);
      this.state.invoice.dueDate = date.toISOString().split('T')[0];
    }
    this.saveState();
    this.populateForm();
    this.renderPreview();
    this.showToast('Preferensi diterapkan ke invoice ini', 'success');
  }

  updateProfileThemeLabel() {
    const label = document.getElementById('profileThemeLabel');
    if (label) label.textContent = this.state.theme === 'dark' ? 'Tema Gelap' : 'Tema Terang';
  }

  ensureInvoiceNumber() {
    if (!this.state.invoice.number) this.state.invoice.number = this.generateInvoiceNumber();
  }

  generateInvoiceNumber() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `INV-${yyyy}${mm}${dd}-001`;
  }

  // Elements
  initElements() {
    this.mobileTabs = document.querySelectorAll('.mobile-tab');
    this.sidebarItems = document.querySelectorAll('.sidebar-item');
    this.tabPanels = document.querySelectorAll('.tab-panel');
    this.themeToggle = document.getElementById('themeToggle');
    this.sidebarThemeToggle = document.getElementById('sidebarThemeToggle');
    this.sidebarToggle = document.getElementById('sidebarToggle');
    this.sidebar = document.getElementById('sidebar');
    this.sidebarBackdrop = document.getElementById('sidebarBackdrop');

    this.btnPrint = document.getElementById('btnPrint');
    this.btnDownloadPDF = document.getElementById('btnDownloadPDF');
    this.btnPrintFull = document.getElementById('btnPrintFull');
    this.btnDownloadPDFFull = document.getElementById('btnDownloadPDFFull');
    this.btnGoToEditor = document.getElementById('btnGoToEditor');

    this.btnAddItem = document.getElementById('btnAddItem');
    this.fabAddItem = document.getElementById('fabAddItem');

    this.statusRadios = document.querySelectorAll('input[name="invoiceStatus"]');

    this.btnClearData = document.getElementById('btnClearData');
    this.btnExportData = document.getElementById('btnExportData');
    this.btnImportData = document.getElementById('btnImportData');
    this.importFile = document.getElementById('importFile');
    this.btnSaveBusinessProfile = document.getElementById('btnSaveBusinessProfile');
    this.btnApplyBusinessProfile = document.getElementById('btnApplyBusinessProfile');
    this.btnSavePreferences = document.getElementById('btnSavePreferences');
    this.btnApplyPreferences = document.getElementById('btnApplyPreferences');
    this.btnProfileTheme = document.getElementById('btnProfileTheme');

    this.itemsList = document.getElementById('itemsList');
    this.emptyItemsHint = document.getElementById('emptyItemsHint');
    this.invoicePreviewFull = document.getElementById('invoicePreviewFull');
    this.previewCanvas = document.getElementById('previewCanvas');
    this.historyList = document.getElementById('historyList');
    this.toastContainer = document.getElementById('toastContainer');

    this.confirmModal = document.getElementById('confirmModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.modalMessage = document.getElementById('modalMessage');
    this.modalConfirm = document.getElementById('modalConfirm');
    this.modalCancel = document.getElementById('modalCancel');
    this.modalClose = document.getElementById('modalClose');

    this.businessLogoInput = document.getElementById('businessLogo');
    this.logoPreview = document.getElementById('logoPreview');
    this.logoPlaceholder = document.getElementById('logoPlaceholder');
    this.signatureInput = document.getElementById('signature');
    this.signaturePreview = document.getElementById('signaturePreview');
    this.signaturePlaceholder = document.getElementById('signaturePlaceholder');

    this.discountTypeEl = document.getElementById('discountType');
    this.discountValueEl = document.getElementById('discountValue');
    this.discountPrefix = document.getElementById('discountPrefix');
  }

  // Events
  initEventListeners() {
    const allTabTriggers = [...this.mobileTabs, ...this.sidebarItems];
    allTabTriggers.forEach(item => {
      item.addEventListener('click', () => this.switchTab(item.dataset.tab));
    });

    if (this.btnGoToEditor) this.btnGoToEditor.addEventListener('click', () => this.switchTab('editor'));

    // Sidebar toggle (mobile)
    if (this.sidebarToggle) {
      this.sidebarToggle.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.addEventListener('click', () => this.closeSidebar());
    }

    // Theme
    if (this.themeToggle) this.themeToggle.addEventListener('click', () => this.toggleTheme());
    if (this.sidebarThemeToggle) this.sidebarThemeToggle.addEventListener('click', () => this.toggleTheme());

    // Print & PDF
    const handlePrint = () => this.printInvoice();
    const handleDownload = () => this.downloadPDF();
    if (this.btnPrint) this.btnPrint.addEventListener('click', handlePrint);
    if (this.btnDownloadPDF) this.btnDownloadPDF.addEventListener('click', handleDownload);
    if (this.btnPrintFull) this.btnPrintFull.addEventListener('click', handlePrint);
    const btnShare = document.getElementById('btnShareInvoice');
    if (btnShare) btnShare.addEventListener('click', () => this.shareInvoice());
    const btnSaveHistory = document.getElementById('btnSaveHistory');
    if (btnSaveHistory) btnSaveHistory.addEventListener('click', () => this.saveToHistory());
    if (this.btnDownloadPDFFull) this.btnDownloadPDFFull.addEventListener('click', handleDownload);

    // Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); this.printInvoice(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.downloadPDF(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); this.addItem(); }
    });

    // Status radios
    this.statusRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        this.state.invoice.status = e.target.value;
        this.saveState();
        this.renderPreview();
        this.syncStatusUI();
      });
    });

    this.bindInputs();

    if (this.btnAddItem) this.btnAddItem.addEventListener('click', () => this.addItem());
    if (this.fabAddItem) this.fabAddItem.addEventListener('click', () => this.addItem());

    // Discount prefix sync
    if (this.discountTypeEl) {
      this.discountTypeEl.addEventListener('change', () => {
        this.updateDiscountPrefix();
      });
    }

    // Images
    this.initImageUpload(this.businessLogoInput, this.logoPreview, this.logoPlaceholder, (dataUrl) => {
      this.state.business.logo = dataUrl;
      this.saveState(); this.renderPreview();
    });
    this.initImageUpload(this.signatureInput, this.signaturePreview, this.signaturePlaceholder, (dataUrl) => {
      this.state.signature = dataUrl;
      this.saveState(); this.renderPreview();
    });

    // Profil & Preferensi
    if (this.btnSaveBusinessProfile) this.btnSaveBusinessProfile.addEventListener('click', () => {
      this.businessProfile = this.readBusinessProfileForm();
      this.saveBusinessProfile();
      this.showToast('Profil bisnis disimpan', 'success');
    });
    if (this.btnApplyBusinessProfile) this.btnApplyBusinessProfile.addEventListener('click', () => this.applyBusinessProfile());
    if (this.btnSavePreferences) this.btnSavePreferences.addEventListener('click', () => {
      this.preferences = this.readPreferencesForm();
      this.savePreferences();
      this.showToast('Preferensi disimpan', 'success');
    });
    if (this.btnApplyPreferences) this.btnApplyPreferences.addEventListener('click', () => this.applyPreferences());
    if (this.btnProfileTheme) this.btnProfileTheme.addEventListener('click', () => {
      this.toggleTheme();
      this.updateProfileThemeLabel();
    });

    // Settings
    if (this.btnClearData) {
      this.btnClearData.addEventListener('click', () => {
        this.showConfirm('Hapus Semua Data?', 'Semua perubahan akan dihapus dan kembali ke default pabrik.', () => {
          localStorage.removeItem('invoicepro_state');
          this.state = JSON.parse(JSON.stringify(defaultState));
          this.ensureInvoiceNumber();
          this.populateForm();
          this.renderItemsList();
          this.renderPreview();
          this.showToast('Data di-reset ke default', 'success');
        });
      });
    }
    if (this.btnExportData) this.btnExportData.addEventListener('click', () => this.exportJSON());
    if (this.btnImportData && this.importFile) {
      this.btnImportData.addEventListener('click', () => this.importFile.click());
      this.importFile.addEventListener('change', (e) => this.importJSON(e));
    }

    // Close modal on backdrop click (dialog)
    if (this.confirmModal) {
      this.confirmModal.addEventListener('click', (e) => {
        const rect = this.confirmModal.getBoundingClientRect();
        const inDialog = rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width;
        if (!inDialog) this.closeModal();
      });
    }
    if (this.modalCancel) this.modalCancel.addEventListener('click', () => this.closeModal());
    if (this.modalClose) this.modalClose.addEventListener('click', () => this.closeModal());
  }

  // Tabs
  switchTab(tabName) {
    this.mobileTabs.forEach(n => {
      const active = n.dataset.tab === tabName;
      n.classList.toggle('active', active);
      n.setAttribute('aria-selected', active);
    });
    this.sidebarItems.forEach(n => {
      const active = n.dataset.tab === tabName;
      n.classList.toggle('active', active);
      if (active) n.setAttribute('aria-current', 'true'); else n.removeAttribute('aria-current');
    });
    this.tabPanels.forEach(p => {
      const active = p.id === `${tabName}Tab`;
      p.classList.toggle('active', active);
      if (active) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    this.closeSidebar();
    if (tabName === 'preview') this.renderPreview();
    this.initIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleSidebar() {
    if (!this.sidebar) return;
    const open = this.sidebar.classList.toggle('open');
    document.body.classList.toggle('sidebar-open', open);
    if (this.sidebarBackdrop) {
      this.sidebarBackdrop.style.display = open ? 'block' : 'none';
    }
    if (this.sidebarToggle) this.sidebarToggle.setAttribute('aria-expanded', open);
  }
  closeSidebar() {
    if (!this.sidebar) return;
    this.sidebar.classList.remove('open');
    document.body.classList.remove('sidebar-open');
    if (this.sidebarBackdrop) this.sidebarBackdrop.style.display = 'none';
    if (this.sidebarToggle) this.sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  // Theme
  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme();
    this.saveState();
  }
  applyTheme() {
    if (this.state.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    this.updateProfileThemeLabel();
  }

  // Form
  populateForm() {
    const s = this.state;
    this.setVal('businessName', s.business.name);
    this.setVal('businessAddress', s.business.address);
    this.setVal('businessEmail', s.business.email);
    this.setVal('businessPhone', s.business.phone);
    if (s.business.logo && this.logoPreview) {
      this.logoPreview.src = s.business.logo;
      this.logoPreview.hidden = false;
      if (this.logoPlaceholder) this.logoPlaceholder.hidden = true;
    } else if (this.logoPreview) {
      this.logoPreview.hidden = true;
      if (this.logoPlaceholder) this.logoPlaceholder.hidden = false;
    }

    this.setVal('invoiceNumber', s.invoice.number);
    this.setVal('invoiceDate', s.invoice.date);
    this.setVal('dueDate', s.invoice.dueDate);
    this.setVal('currency', s.invoice.currency);

    // Status radios
    this.statusRadios.forEach(r => { r.checked = r.value === s.invoice.status; });
    this.syncStatusUI();

    this.setVal('customerName', s.customer.name);
    this.setVal('customerCompany', s.customer.company);
    this.setVal('customerAddress', s.customer.address);
    this.setVal('customerEmail', s.customer.email);
    this.setVal('customerPhone', s.customer.phone);

    this.setVal('discountType', s.calculations.discountType);
    this.setVal('discountValue', s.calculations.discountValue);
    this.setVal('taxRate', s.calculations.taxRate);
    this.setVal('paymentUrl', s.calculations.paymentUrl);

    this.setVal('notes', s.notes);
    this.populateProfilePreferences();
    this.setVal('paymentTerms', s.paymentTerms);

    if (s.signature && this.signaturePreview) {
      this.signaturePreview.src = s.signature;
      this.signaturePreview.hidden = false;
      if (this.signaturePlaceholder) this.signaturePlaceholder.hidden = true;
    } else if (this.signaturePreview) {
      this.signaturePreview.hidden = true;
      if (this.signaturePlaceholder) this.signaturePlaceholder.hidden = false;
    }

    this.updateDiscountPrefix();
  }

  setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  }

  syncStatusUI() {
    document.querySelectorAll('.status-option').forEach(opt => {
      const v = opt.dataset.status;
      const checked = this.state.invoice.status === v;
      opt.classList.toggle('is-active', checked);
    });
  }

  updateDiscountPrefix() {
    if (!this.discountPrefix || !this.discountTypeEl) return;
    const type = this.discountTypeEl.value;
    const prefix = this.discountPrefix.querySelector('.input-prefix');
    if (prefix) prefix.textContent = type === 'percent' ? '%' : 'Rp';
  }

  bindInputs() {
    const mappings = [
      ['businessName', ['business', 'name']],
      ['businessAddress', ['business', 'address']],
      ['businessEmail', ['business', 'email']],
      ['businessPhone', ['business', 'phone']],
      ['invoiceNumber', ['invoice', 'number']],
      ['invoiceDate', ['invoice', 'date']],
      ['dueDate', ['invoice', 'dueDate']],
      ['currency', ['invoice', 'currency']],
      ['customerName', ['customer', 'name']],
      ['customerCompany', ['customer', 'company']],
      ['customerAddress', ['customer', 'address']],
      ['customerEmail', ['customer', 'email']],
      ['customerPhone', ['customer', 'phone']],
      ['discountType', ['calculations', 'discountType']],
      ['discountValue', ['calculations', 'discountValue'], 'number'],
      ['taxRate', ['calculations', 'taxRate'], 'number'],
      ['paymentUrl', ['calculations', 'paymentUrl']],
      ['notes', ['notes']],
      ['paymentTerms', ['paymentTerms']]
    ];
    mappings.forEach(([id, path, type]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const handler = () => {
        let val = el.value;
        if (type === 'number') {
          val = parseFloat(val) || 0;
          if (val < 0) { val = 0; el.value = 0; }
        }
        if (path.length === 1) this.state[path[0]] = val;
        else if (path.length === 2) this.state[path[0]][path[1]] = val;
        this.saveState();
        this.renderPreview();
        if (id === 'discountType') this.updateDiscountPrefix();
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  // Items - Cards (Mobile-First)
  renderItemsList() {
    if (!this.itemsList) return;
    this.itemsList.innerHTML = '';

    if (!this.state.items.length) {
      if (this.emptyItemsHint) this.emptyItemsHint.hidden = false;
      return;
    }
    if (this.emptyItemsHint) this.emptyItemsHint.hidden = true;

    this.state.items.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.setAttribute('role', 'listitem');
      card.dataset.id = item.id;
      const canRemove = this.state.items.length > 1;
      card.innerHTML = `
        <div class="item-header">
          <span class="item-number">#${index + 1}</span>
          <button type="button" class="btn-remove-item" aria-label="Hapus item ${index + 1}" ${canRemove ? '' : 'disabled'}>
            <i data-lucide="trash-2"></i>
          </button>
        </div>
        <div class="item-fields">
          <div class="item-field">
            <label for="item-name-${item.id}">Nama Produk / Jasa *</label>
            <input type="text" id="item-name-${item.id}" class="item-name-input" placeholder="Contoh: Desain Logo Premium" value="${this.escapeHtml(item.name)}" autocomplete="off">
          </div>
          <div class="item-field">
            <label for="item-desc-${item.id}">Deskripsi</label>
            <textarea id="item-desc-${item.id}" class="item-desc-input" placeholder="Rincian pekerjaan, revisi, atau catatan item" rows="2">${this.escapeHtml(item.description || '')}</textarea>
          </div>
          <div class="item-field" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label for="item-qty-${item.id}">Qty</label>
              <input type="number" id="item-qty-${item.id}" class="item-qty-input" inputmode="numeric" min="1" step="1" value="${item.qty}">
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              <label for="item-price-${item.id}">Harga</label>
              <input type="number" id="item-price-${item.id}" class="item-price-input" inputmode="numeric" min="0" step="any" value="${item.price}">
            </div>
          </div>
        </div>
        <div class="item-total-row">
          <span class="item-total-label">Total baris</span>
          <span class="item-total-value">${this.formatCurrency(item.qty * item.price)}</span>
        </div>
      `;

      const nameInput = card.querySelector('.item-name-input');
      const descInput = card.querySelector('.item-desc-input');
      const qtyInput = card.querySelector('.item-qty-input');
      const priceInput = card.querySelector('.item-price-input');
      const totalValue = card.querySelector('.item-total-value');
      const removeBtn = card.querySelector('.btn-remove-item');

      const updateRow = () => {
        item.name = nameInput.value;
        item.description = descInput.value;
        // Validation: qty minimal 1, harga tidak negatif
        let qty = parseInt(qtyInput.value, 10);
        if (!Number.isFinite(qty) || qty < 1) { qty = 1; qtyInput.value = 1; }
        item.qty = qty;
        let price = parseFloat(priceInput.value);
        if (!Number.isFinite(price) || price < 0) { price = 0; priceInput.value = 0; }
        item.price = price;
        totalValue.textContent = this.formatCurrency(item.qty * item.price);
        this.saveState();
        this.renderPreview();
      };

      nameInput.addEventListener('input', updateRow);
      descInput.addEventListener('input', updateRow);
      qtyInput.addEventListener('input', updateRow);
      qtyInput.addEventListener('change', updateRow);
      priceInput.addEventListener('input', updateRow);
      priceInput.addEventListener('change', updateRow);

      if (canRemove) {
        removeBtn.addEventListener('click', () => this.removeItem(item.id));
      }

      this.itemsList.appendChild(card);
    });
    this.initIcons();
  }

  addItem() {
    const newItem = { id: 'item_' + Date.now(), name: '', description: '', qty: 1, price: 0 };
    this.state.items.push(newItem);
    this.saveState();
    this.renderItemsList();
    this.renderPreview();
    setTimeout(() => {
      const lastInput = this.itemsList.querySelector(`#item-name-${newItem.id}`);
      if (lastInput) { lastInput.focus(); lastInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }, 50);
  }

  removeItem(id) {
    if (this.state.items.length <= 1) {
      this.showToast('Minimal harus ada 1 item', 'error');
      return;
    }
    this.state.items = this.state.items.filter(it => it.id !== id);
    this.saveState();
    this.renderItemsList();
    this.renderPreview();
    this.showToast('Item dihapus', 'success');
  }

  // Totals
  calculateTotals() {
    const subtotal = this.state.items.reduce((acc, it) => acc + (it.qty * it.price), 0);
    let discount = 0;
    if (this.state.calculations.discountType === 'percent') discount = subtotal * (this.state.calculations.discountValue / 100);
    else discount = this.state.calculations.discountValue;
    discount = Math.min(subtotal, Math.max(0, discount));
    const taxable = Math.max(0, subtotal - discount);
    const taxRate = Math.min(100, Math.max(0, Number(this.state.calculations.taxRate) || 0));
    const tax = taxable * (taxRate / 100);
    const grandTotal = taxable + tax;
    return { subtotal, discount, tax, grandTotal };
  }

  formatCurrency(amount) {
    const cur = this.state.invoice.currency || 'IDR';
    const num = Math.round(amount);
    if (cur === 'IDR') return 'Rp ' + num.toLocaleString('id-ID');
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(amount); }
    catch { return `${cur} ${amount.toLocaleString()}`; }
  }

  formatDate(dateStr) {
    if (!dateStr) return '-';
    try { const [y,m,d] = dateStr.split('-'); const dt = new Date(y, m-1, d); return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return dateStr; }
  }

  // Images
  initImageUpload(inputEl, previewEl, placeholderEl, onSave) {
    if (!inputEl || !previewEl || !placeholderEl) return;
    const parent = inputEl.closest('.logo-upload, .signature-upload') || inputEl.parentElement;
    const trigger = () => inputEl.click();
    parent.addEventListener('click', (e) => { if (e.target !== inputEl) trigger(); });
    parent.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); trigger(); } });
    inputEl.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { this.showToast('Pilih file gambar valid', 'error'); return; }
      if (file.size > 2 * 1024 * 1024) { this.showToast('Ukuran gambar maksimal 2MB', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        previewEl.src = dataUrl;
        previewEl.hidden = false;
        placeholderEl.hidden = true;
        onSave(dataUrl);
        this.showToast('Gambar berhasil diunggah', 'success');
        this.initIcons();
      };
      reader.readAsDataURL(file);
    });
  }

  // Preview
  renderPreview() {
    if (!this.invoicePreviewFull) return;
    // Validate required before render? still render with placeholders
    const html = this.buildInvoiceHTML();
    this.invoicePreviewFull.innerHTML = html;
    this.invoicePreviewFull.className = 'invoice-preview';
    this.renderQRCode(this.invoicePreviewFull);
    this.initIcons();
  }

  buildInvoiceHTML() {
    const { business, invoice, customer, items, calculations, notes, paymentTerms, signature } = this.state;
    const totals = this.calculateTotals();
    const status = (invoice.status || 'unpaid').toUpperCase();
    const watermarkClass = `watermark-${(invoice.status || 'unpaid').toLowerCase()}`;
    const rows = items.map(it => `
      <tr>
        <td style="width: 40%">
          <div class="item-name">${this.escapeHtml(it.name || 'Item tanpa nama')}</div>
          ${it.description ? `<div class="item-desc">${this.escapeHtml(it.description)}</div>` : ''}
        </td>
        <td class="item-qty" style="width: 15%; text-align: center;">${it.qty}</td>
        <td class="item-price" style="width: 22%; text-align: right;">${this.formatCurrency(it.price)}</td>
        <td class="item-total" style="width: 23%; text-align: right;">${this.formatCurrency(it.qty * it.price)}</td>
      </tr>
    `).join('');

    return `
      <div class="invoice-watermark ${watermarkClass}"><span>${status}</span></div>
      <div class="inv-header">
        <div class="inv-brand">
          ${business.logo ? `<img class="inv-logo" src="${business.logo}" alt="Logo">` : ''}
          <div class="inv-brand-text">
            <h2>${this.escapeHtml(business.name || 'Nama Bisnis')}</h2>
            ${business.address ? `<p>${this.escapeHtml(business.address)}</p>` : ''}
            ${business.email || business.phone ? `<p>${this.escapeHtml([business.email, business.phone].filter(Boolean).join(' • '))}</p>` : ''}
          </div>
        </div>
        <div class="inv-meta">
          <div class="inv-title">INVOICE</div>
          <div class="inv-number">${this.escapeHtml(invoice.number || 'INV-00000000-000')}</div>
          <div class="inv-meta-grid">
            <div><dt>Tanggal:</dt><dd>${this.formatDate(invoice.date)}</dd></div>
            <div><dt>Jatuh Tempo:</dt><dd>${this.formatDate(invoice.dueDate)}</dd></div>
            <div><dt>Status:</dt><dd style="text-transform:capitalize; font-weight:700;">${this.escapeHtml(invoice.status || 'unpaid')}</dd></div>
          </div>
        </div>
      </div>
      <div class="inv-parties">
        <div class="inv-party">
          <h4>DITAGIHKAN KEPADA</h4>
          <strong>${this.escapeHtml(customer.name || 'Nama Pelanggan')}</strong>
          ${customer.company ? `<div class="company">${this.escapeHtml(customer.company)}</div>` : ''}
          ${customer.address ? `<p>${this.escapeHtml(customer.address)}</p>` : ''}
          ${customer.email || customer.phone ? `<p>${this.escapeHtml([customer.email, customer.phone].filter(Boolean).join(' • '))}</p>` : ''}
        </div>
        <div class="inv-party">
          <h4>DARI</h4>
          <strong>${this.escapeHtml(business.name || 'Nama Bisnis')}</strong>
          ${business.address ? `<p>${this.escapeHtml(business.address)}</p>` : ''}
          ${business.email || business.phone ? `<p>${this.escapeHtml([business.email, business.phone].filter(Boolean).join(' • '))}</p>` : ''}
        </div>
      </div>
      <div class="inv-table-wrap">
        <table class="inv-table">
          <thead><tr><th style="width:40%">Deskripsi</th><th style="width:15%; text-align:center;">Qty</th><th style="width:22%; text-align:right;">Harga</th><th style="width:23%; text-align:right;">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="inv-summary">
        <div class="inv-summary-box">
          <div class="inv-summary-row"><span>Subtotal</span><span>${this.formatCurrency(totals.subtotal)}</span></div>
          ${totals.discount > 0 ? `<div class="inv-summary-row discount"><span>Diskon ${calculations.discountType === 'percent' ? `(${calculations.discountValue}%)` : ''}</span><span>- ${this.formatCurrency(totals.discount)}</span></div>` : ''}
          ${calculations.taxRate > 0 ? `<div class="inv-summary-row"><span>PPN (${calculations.taxRate}%)</span><span>${this.formatCurrency(totals.tax)}</span></div>` : ''}
          <div class="inv-summary-row total"><span>Total Pembayaran</span><span>${this.formatCurrency(totals.grandTotal)}</span></div>
        </div>
      </div>
      <div class="inv-footer">
        ${notes ? `<div class="inv-notes"><h5>Catatan</h5><p>${this.escapeHtml(notes)}</p></div>` : ''}
        ${paymentTerms ? `<div class="inv-notes"><h5>Syarat & Ketentuan</h5><p>${this.escapeHtml(paymentTerms)}</p></div>` : ''}
        <div class="inv-bottom">
          <div class="inv-qr-wrap" ${calculations.paymentUrl ? '' : 'style="display:none;"'}>
            <div class="inv-qr"><span class="inv-qr-label">Scan untuk Pembayaran</span><div class="qr-target"></div></div>
          </div>
          <div class="inv-signature">
            ${signature ? `<img src="${signature}" alt="Tanda tangan">` : '<div style="height:48px;"></div>'}
            <div class="inv-signature-line"></div>
            <p>${this.escapeHtml(business.name || 'Tanda Tangan Pengirim')}</p>
          </div>
        </div>
      </div>
    `;
  }

  renderQRCode(container) {
    const url = this.state.calculations.paymentUrl;
    const target = container.querySelector('.qr-target');
    if (!target) return;
    target.innerHTML = '';
    if (!url) return;
    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(target, { text: url, width: 88, height: 88, colorDark: '#0f172a', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      }
    } catch (e) { console.warn('QR gagal', e); }
  }

  async shareInvoice() {
    if (!this.validateRequired()) return;
    const title = `Invoice ${this.state.invoice.number || 'Invoice'}`;
    const totals = this.calculateTotals();
    const text = `${title}\nPelanggan: ${this.state.customer.name}\nTotal: ${this.formatCurrency(totals.grandTotal)}\nStatus: ${this.state.invoice.status || 'unpaid'}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        this.showToast('Invoice siap dibagikan', 'success');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.showToast('Ringkasan invoice disalin. Browser ini belum mendukung Share.', 'info');
      } else {
        this.showToast('Fitur share tidak didukung browser ini', 'error');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') this.showToast('Gagal membagikan invoice', 'error');
    }
  }

  // History
  getHistory() {
    try {
      const data = JSON.parse(localStorage.getItem('invoicepro_history') || '[]');
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  saveToHistory() {
    if (!this.validateRequired()) return false;
    const snapshot = JSON.parse(JSON.stringify(this.state));
    snapshot.savedAt = new Date().toISOString();

    let history = this.getHistory();
    const existingIndex = history.findIndex(item => item.invoice?.number === snapshot.invoice?.number);

    if (existingIndex >= 0) history[existingIndex] = snapshot;
    else history.unshift(snapshot);

    history = history.slice(0, 50);
    try {
      localStorage.setItem('invoicepro_history', JSON.stringify(history));
      this.renderHistory();
      this.showToast('Invoice disimpan ke riwayat', 'success');
      return true;
    } catch (e) {
      this.showToast('Gagal menyimpan riwayat', 'error');
      return false;
    }
  }

  loadHistoryItem(index) {
    const history = this.getHistory();
    const item = history[index];
    if (!item) return;

    this.state = {
      ...defaultState,
      ...item,
      business: { ...defaultState.business, ...(item.business || {}) },
      invoice: { ...defaultState.invoice, ...(item.invoice || {}) },
      customer: { ...defaultState.customer, ...(item.customer || {}) },
      calculations: { ...defaultState.calculations, ...(item.calculations || {}) },
      items: Array.isArray(item.items) ? item.items : []
    };

    this.saveState();
    this.populateForm();
    this.renderItemsList();
    this.renderPreview();
    this.switchTab('editor');
    this.showToast('Invoice dimuat dari riwayat', 'success');
  }

  deleteHistoryItem(index) {
    const history = this.getHistory();
    if (!history[index]) return;
    history.splice(index, 1);
    localStorage.setItem('invoicepro_history', JSON.stringify(history));
    this.renderHistory();
    this.showToast('Invoice dihapus dari riwayat', 'success');
  }

  renderHistory() {
    const container = document.getElementById('historyList');
    const empty = document.getElementById('historyEmpty');
    if (!container) return;

    const history = this.getHistory();
    container.innerHTML = '';

    if (!history.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    history.forEach((item, index) => {
      const totals = this.calculateTotalsFor(item);
      const row = document.createElement('article');
      row.className = 'history-card';
      row.innerHTML = `
        <div class="history-main">
          <div>
            <strong>${this.escapeHtml(item.invoice?.number || 'Tanpa nomor')}</strong>
            <span>${this.escapeHtml(item.customer?.name || 'Pelanggan')}</span>
          </div>
          <strong>${this.formatCurrencyFor(totals.grandTotal, item.invoice?.currency)}</strong>
        </div>
        <div class="history-meta">
          <span>${this.escapeHtml(this.formatDate(item.invoice?.date))}</span>
          <span class="history-status history-${this.escapeHtml(item.invoice?.status || 'draft')}">${this.escapeHtml(item.invoice?.status || 'draft')}</span>
        </div>
        <div class="history-actions">
          <button type="button" class="btn btn-sm btn-primary history-load"><i data-lucide="folder-open"></i> Muat</button>
          <button type="button" class="btn btn-sm btn-ghost history-delete"><i data-lucide="trash-2"></i></button>
        </div>`;
      row.querySelector('.history-load').addEventListener('click', () => this.loadHistoryItem(index));
      row.querySelector('.history-delete').addEventListener('click', () => this.deleteHistoryItem(index));
      container.appendChild(row);
    });
    this.initIcons();
  }

  calculateTotalsFor(state) {
    const subtotal = (state.items || []).reduce((acc, it) => acc + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    let discount = state.calculations?.discountType === 'percent'
      ? subtotal * ((Number(state.calculations?.discountValue) || 0) / 100)
      : (Number(state.calculations?.discountValue) || 0);
    discount = Math.min(subtotal, Math.max(0, discount));
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * (Math.max(0, Number(state.calculations?.taxRate) || 0) / 100);
    return { subtotal, discount, tax, grandTotal: taxable + tax };
  }

  formatCurrencyFor(amount, currency) {
    const cur = currency || 'IDR';
    const num = Math.round(Number(amount) || 0);
    if (cur === 'IDR') return 'Rp ' + num.toLocaleString('id-ID');
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(num); }
    catch { return `${cur} ${num.toLocaleString()}`; }
  }

  // Export
  validateRequired() {
    const s = this.state;
    if (!s.business.name?.trim()) { this.showToast('Nama bisnis wajib diisi', 'error'); return false; }
    if (!s.invoice.number?.trim()) { this.showToast('Nomor invoice wajib diisi', 'error'); return false; }
    if (!s.customer.name?.trim()) { this.showToast('Nama pelanggan wajib diisi', 'error'); return false; }
    if (!s.invoice.date || !s.invoice.dueDate) { this.showToast('Tanggal invoice & jatuh tempo wajib diisi', 'error'); return false; }
    if (s.invoice.dueDate < s.invoice.date) { this.showToast('Jatuh tempo tidak boleh sebelum tanggal invoice', 'error'); return false; }
    const taxRate = Number(s.calculations.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) { this.showToast('PPN harus antara 0% sampai 100%', 'error'); return false; }
    const discountValue = Number(s.calculations.discountValue);
    if (!Number.isFinite(discountValue) || discountValue < 0) { this.showToast('Nilai diskon tidak valid', 'error'); return false; }
    for (const it of s.items) {
      if (!it.name?.trim()) { this.showToast('Nama produk/jasa tidak boleh kosong', 'error'); return false; }
      if (it.qty < 1) { this.showToast('Qty minimal 1', 'error'); return false; }
      if (it.price < 0) { this.showToast('Harga tidak boleh negatif', 'error'); return false; }
    }
    return true;
  }

  printInvoice() {
    if (!this.validateRequired()) return;
    this.renderPreview();
    this.switchTab('preview');
    setTimeout(() => { window.print(); this.showToast('Dialog print dibuka', 'success'); }, 150);
  }

  async downloadPDF() {
    if (!this.validateRequired()) return;

    const rawNumber = this.state.invoice.number || 'INV-DRAFT';
    const safeNumber = rawNumber.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'INV-DRAFT';
    const filename = `Invoice-${safeNumber}.pdf`;
    const target = this.invoicePreviewFull;

    if (!target) {
      this.showToast('Preview tidak ditemukan', 'error');
      return;
    }
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      this.showToast('Library PDF belum dimuat. Coba refresh halaman.', 'error');
      return;
    }

    this.showToast('Menyiapkan PDF...', 'success');
    let clone = null;

    try {
      // Pastikan data terbaru sudah masuk ke preview sebelum screenshot.
      this.renderPreview();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      clone = target.cloneNode(true);
      Object.assign(clone.style, {
        width: '794px',
        maxWidth: 'none',
        minHeight: '1123px',
        height: 'auto',
        boxShadow: 'none',
        position: 'fixed',
        top: '0',
        left: '-10000px',
        zIndex: '-1',
        background: '#ffffff'
      });
      document.body.appendChild(clone);

      // Scale 1.5 lebih ramah RAM di HP tanpa membuat teks PDF buram.
      const canvas = await html2canvas(clone, {
        scale: 1.5,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1024,
        imageTimeout: 10000
      });

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const pxPerMm = canvas.width / pageWidth;
      const pageHeightPx = Math.floor(pageHeight * pxPerMm);

      // Potong canvas per tinggi A4. Tidak ada lagi pengurangan 297mm
      // berdasarkan asumsi tinggi sebelumnya, sehingga halaman terakhir
      // tidak bergeser/terduplikasi.
      let offsetY = 0;
      let pageIndex = 0;

      while (offsetY < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - offsetY);
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;

        const ctx = pageCanvas.getContext('2d');
        if (!ctx) throw new Error('Canvas PDF tidak tersedia');

        ctx.drawImage(
          canvas,
          0, offsetY, canvas.width, sliceHeightPx,
          0, 0, canvas.width, sliceHeightPx
        );

        if (pageIndex > 0) pdf.addPage();

        const pageImg = pageCanvas.toDataURL('image/jpeg', 0.92);
        const sliceHeightMm = sliceHeightPx / pxPerMm;
        pdf.addImage(pageImg, 'JPEG', 0, 0, pageWidth, sliceHeightMm, undefined, 'FAST');

        offsetY += sliceHeightPx;
        pageIndex++;
      }

      pdf.save(filename);
      this.showToast(`Berhasil mengunduh ${filename}`, 'success');
    } catch (err) {
      console.error('PDF export error:', err);
      this.showToast('Gagal membuat PDF: ' + (err?.message || 'kesalahan tidak diketahui'), 'error');
    } finally {
      if (clone?.parentNode) clone.parentNode.removeChild(clone);
    }
  }

  exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `invoice-backup-${this.state.invoice.number || 'data'}.json`);
    document.body.appendChild(a); a.click(); a.remove();
    this.showToast('Data diekspor sebagai JSON', 'success');
  }

  importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (typeof imported !== 'object' || !imported.items) throw new Error('Format JSON tidak valid');
        this.state = {
          ...defaultState,
          ...imported,
          business: { ...defaultState.business, ...(imported.business || {}) },
          invoice: { ...defaultState.invoice, ...(imported.invoice || {}) },
          customer: { ...defaultState.customer, ...(imported.customer || {}) },
          calculations: { ...defaultState.calculations, ...(imported.calculations || {}) },
          items: Array.isArray(imported.items) && imported.items.length ? imported.items : defaultState.items
        };
        this.saveState();
        this.populateForm();
        this.renderItemsList();
        this.renderPreview();
        this.showToast('Data berhasil diimpor', 'success');
      } catch (err) { this.showToast('Gagal impor: ' + err.message, 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // Toast & Modal
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
    toast.innerHTML = `<i data-lucide="${iconName}"></i><span>${this.escapeHtml(message)}</span>`;
    this.toastContainer.appendChild(toast);
    this.initIcons();
    setTimeout(() => { toast.style.animation = 'toastOut 200ms forwards'; setTimeout(() => toast.remove(), 200); }, 3200);
  }

  showConfirm(title, message, onConfirm) {
    this.modalTitle.textContent = title;
    this.modalMessage.textContent = message;
    this._confirmCb = onConfirm;
    if (typeof this.confirmModal.showModal === 'function') {
      if (!this.confirmModal.open) this.confirmModal.showModal();
    } else {
      this.confirmModal.setAttribute('open', '');
      this.confirmModal.style.display = 'block';
    }
    this.modalConfirm.onclick = () => { this.closeModal(); if (this._confirmCb) this._confirmCb(); };
  }

  closeModal() {
    if (this.confirmModal && typeof this.confirmModal.close === 'function' && this.confirmModal.open) {
      this.confirmModal.close();
    } else if (this.confirmModal) {
      this.confirmModal.removeAttribute('open');
      this.confirmModal.style.display = 'none';
    }
    if (this.modalConfirm) this.modalConfirm.onclick = null;
    this._confirmCb = null;
  }

  escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, m => map[m]);
  }

  initIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new InvoiceApp(); });
