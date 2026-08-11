(function () {
  'use strict';

  var VERSION = '2026-08-11.4';
  var GUARD = '__kfzOrderFix20260811V4';
  var LEGACY_FORM_SELECTOR = '#secure-ikfz #df-intake-form';
  var LEGACY_PREP_SELECTOR = '#secure-ikfz .df-prep';

  if (window[GUARD]) return;
  window[GUARD] = true;

  var VARIANTS = {
    neuzulassung: 51237294539018,
    umschreibung: 53495252254986,
    wiederzulassung: 53495253041418,
    'adress-namens-aenderung': 53495252910346
  };

  var TITLES = {
    neuzulassung: 'Neuzulassung',
    umschreibung: 'Umschreibung',
    wiederzulassung: 'Wiederzulassung',
    'adress-namens-aenderung': 'Adress- oder Namensänderung'
  };

  function installCriticalStyles() {
    if (document.getElementById('kfz-order-fix-critical')) return;
    var style = document.createElement('style');
    style.id = 'kfz-order-fix-critical';
    style.textContent = [
      LEGACY_FORM_SELECTOR + ',' + LEGACY_PREP_SELECTOR + '{display:none!important;visibility:hidden!important}',
      '#secure-ikfz .kfz-fixed-order{margin-top:22px;padding:22px;border:1px solid #b9d5ec;border-radius:15px;background:#fff;box-shadow:0 10px 28px rgba(16,47,77,.08)}',
      '#secure-ikfz .kfz-fixed-order h3{margin:0 0 8px;font-size:1.25rem}',
      '#secure-ikfz .kfz-fixed-order p{margin:0 0 18px;line-height:1.5}',
      '#secure-ikfz .kfz-fixed-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}',
      '#secure-ikfz .kfz-fixed-field{display:flex;flex-direction:column;gap:7px;font-weight:750}',
      '#secure-ikfz .kfz-fixed-field select{width:100%;min-height:50px;padding:12px 13px;border:1px solid #9eb6ca;border-radius:9px;background:#fff;color:#10253e;font:inherit}',
      '#secure-ikfz .kfz-fixed-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:3px 0 4px}',
      '#secure-ikfz .kfz-fixed-step{padding:13px;border:1px solid #dbe8f5;border-radius:11px;background:#f7fbff;font-size:.88rem;line-height:1.42}',
      '#secure-ikfz .kfz-fixed-step b{display:block;margin-bottom:4px;color:#087d95}',
      '#secure-ikfz .kfz-fixed-consent{display:grid;grid-template-columns:20px minmax(0,1fr);gap:10px;align-items:start;font-size:.88rem;line-height:1.45}',
      '#secure-ikfz .kfz-fixed-consent input{width:18px;height:18px;margin:1px 0 0;accent-color:#087d95}',
      '#secure-ikfz .kfz-fixed-submit{width:100%;min-height:52px;padding:14px 18px;border:0;border-radius:11px;background:#087d95;color:#fff;font:800 1rem/1.2 inherit;cursor:pointer}',
      '#secure-ikfz .kfz-fixed-submit:disabled{opacity:.65;cursor:wait}',
      '#secure-ikfz .kfz-fixed-status{min-height:1.4em;margin:12px 0 0;font-weight:750}',
      '#secure-ikfz .kfz-fixed-status[data-kind="error"]{color:#b42318}',
      '#secure-ikfz .kfz-fixed-status[data-kind="ok"]{color:#087d95}',
      '#secure-ikfz .kfz-fixed-security{margin:16px 0 0;padding:13px;border-left:4px solid #087d95;border-radius:9px;background:#eefafd;font-size:.88rem;line-height:1.48}',
      '@media(max-width:700px){#secure-ikfz .kfz-fixed-steps{grid-template-columns:1fr}#secure-ikfz .kfz-fixed-order{padding:19px 16px}}'
    ].join('');
    (document.head || document.documentElement).appendChild(style);
  }

  installCriticalStyles();
  document.documentElement.setAttribute('data-kfz-order-fix', VERSION);

  document.addEventListener('submit', function (event) {
    var target = event.target;
    if (!target || !target.matches || !target.matches(LEGACY_FORM_SELECTOR)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
  }, true);

  function setText(element, text) {
    if (element) element.textContent = text;
  }

  function setStatus(form, text, kind) {
    var status = form.querySelector('.kfz-fixed-status');
    if (!status) return;
    status.textContent = text || '';
    status.dataset.kind = kind || '';
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }

  function createHiddenInput(form, name, value) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  function nativeCartFallback(variantId, title) {
    var form = document.createElement('form');
    form.method = 'post';
    form.action = '/cart/add';
    form.hidden = true;
    createHiddenInput(form, 'id', String(variantId));
    createHiddenInput(form, 'quantity', '1');
    createHiddenInput(form, 'properties[Zulassungsvorgang]', title);
    createHiddenInput(form, 'properties[Unterlagenstatus]', 'Geschützter Upload-Link nach Bestellung erforderlich');
    createHiddenInput(form, 'properties[Bestellablauf-Version]', VERSION);
    createHiddenInput(form, 'return_to', '/checkout');
    document.body.appendChild(form);
    form.submit();
  }

  function addToCart(variantId, title) {
    return fetch('/cart/add.js', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        items: [{
          id: Number(variantId),
          quantity: 1,
          properties: {
            Zulassungsvorgang: title,
            Unterlagenstatus: 'Geschützter Upload-Link nach Bestellung erforderlich',
            'Bestellablauf-Version': VERSION
          }
        }]
      })
    }).then(function (response) {
      return response.text().then(function (text) {
        var result = {};
        try {
          result = text ? JSON.parse(text) : {};
        } catch (_error) {
          result = {};
        }
        if (!response.ok) {
          throw new Error(result.description || result.message || 'Der Warenkorb konnte nicht vorbereitet werden.');
        }
        return result;
      });
    });
  }

  function removeLegacyUpload(section) {
    if (!section) return;
    var legacyForm = section.querySelector('#df-intake-form');
    var legacyPrep = section.querySelector('.df-prep');
    if (legacyForm) legacyForm.remove();
    if (legacyPrep) legacyPrep.remove();
  }

  function buildOrderForm(section) {
    if (!section) return;
    installCriticalStyles();
    removeLegacyUpload(section);

    var shell = section.querySelector('.df-intake__shell');
    if (!shell) return;

    section.dataset.kfzOrderFixed = VERSION;
    document.documentElement.setAttribute('data-kfz-order-fix', VERSION);

    setText(shell.querySelector('.df-kicker'), 'DIGITALE ZULASSUNG · SICHER BESTELLEN');
    setText(shell.querySelector('h2'), 'Zulassung auswählen. Sicher bezahlen. Unterlagen geschützt nachreichen.');
    setText(
      shell.querySelector('.df-lead'),
      'Wählen Sie den gewünschten Zulassungsvorgang und schließen Sie die Bestellung im Shopify-Checkout ab. Fahrzeugunterlagen, Ausweis, IBAN und Sicherheitscodes werden nicht in Shopify gespeichert. Sie erhalten dafür nach der Bestellung einen persönlichen geschützten Upload-Link.'
    );

    var info = shell.querySelector('.df-azure');
    if (info) {
      info.innerHTML = '<div><strong>Keine sensiblen Unterlagen im Checkout</strong><span>Im Checkout werden nur die gewählte Leistung und Ihre normalen Bestelldaten erfasst. Dokumente und Sicherheitscodes werden anschließend ausschließlich über den persönlichen geschützten Upload-Link angefordert.</span></div>';
    }

    var existing = shell.querySelector('#kfz-fixed-order-form');
    if (existing) existing.remove();

    var form = document.createElement('form');
    form.id = 'kfz-fixed-order-form';
    form.className = 'kfz-fixed-order';
    form.innerHTML = [
      '<h3>Digitale Zulassung bestellen</h3>',
      '<p>Der Festpreis und die gewählte Leistung werden direkt in den Shopify-Checkout übernommen.</p>',
      '<div class="kfz-fixed-grid">',
      '<label class="kfz-fixed-field">Zulassungsvorgang',
      '<select name="service" required>',
      '<option value="">Bitte wählen</option>',
      '<option value="neuzulassung">Neuzulassung – 120,00 €</option>',
      '<option value="umschreibung">Umschreibung – 120,00 €</option>',
      '<option value="wiederzulassung">Wiederzulassung – 120,00 €</option>',
      '<option value="adress-namens-aenderung">Adress- oder Namensänderung – 49,00 €</option>',
      '</select></label>',
      '<div class="kfz-fixed-steps" aria-label="Ablauf">',
      '<div class="kfz-fixed-step"><b>1. Bestellen</b>Leistung wählen und Checkout abschließen.</div>',
      '<div class="kfz-fixed-step"><b>2. Geschützt hochladen</b>Persönlichen Upload- und Identifikationslink erhalten.</div>',
      '<div class="kfz-fixed-step"><b>3. Zulassung</b>Wir prüfen die Unterlagen und bearbeiten den Vorgang.</div>',
      '</div>',
      '<label class="kfz-fixed-consent"><input name="privacyAccepted" type="checkbox" required><span>Ich habe die <a href="/policies/privacy-policy" target="_blank" rel="noopener">Datenschutzhinweise</a> gelesen und möchte den persönlichen geschützten Upload-Link nach der Bestellung erhalten.</span></label>',
      '<button class="kfz-fixed-submit" type="submit">Weiter zum sicheren Checkout</button>',
      '<p class="kfz-fixed-status" aria-live="polite"></p>',
      '</div>',
      '<div class="kfz-fixed-security"><strong>Wichtig:</strong> Ausweis, IBAN, Sicherheitscodes und Fahrzeugunterlagen bitte nicht per WhatsApp oder normaler E-Mail senden.</div>'
    ].join('');

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.reportValidity()) return;

      var select = form.elements.service;
      var service = select ? select.value : '';
      var variantId = VARIANTS[service];
      var title = TITLES[service];
      var button = form.querySelector('.kfz-fixed-submit');

      if (!variantId || !title) {
        setStatus(form, 'Bitte wählen Sie den passenden Zulassungsvorgang.', 'error');
        if (select) select.focus();
        return;
      }

      button.disabled = true;
      button.textContent = 'Checkout wird vorbereitet …';
      setStatus(form, 'Die Bestellung wird vorbereitet …', '');

      addToCart(variantId, title)
        .then(function () {
          setStatus(form, 'Bestellung vorbereitet. Der Checkout wird geöffnet …', 'ok');
          window.location.assign('/checkout');
        })
        .catch(function (error) {
          console.error('[Kfz-Bestellablauf] Ajax-Warenkorb fehlgeschlagen; Shopify-Fallback wird verwendet.', error);
          setStatus(form, 'Shopify wird direkt geöffnet …', '');
          nativeCartFallback(variantId, title);
        });
    });

    if (info && info.parentNode) {
      info.insertAdjacentElement('afterend', form);
    } else {
      shell.appendChild(form);
    }
  }

  function initialise() {
    buildOrderForm(document.getElementById('secure-ikfz'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialise, { once: true });
  } else {
    initialise();
  }

  document.addEventListener('shopify:section:load', initialise);

  var observer = new MutationObserver(function () {
    var section = document.getElementById('secure-ikfz');
    if (!section) return;
    if (section.querySelector('#df-intake-form') || !section.querySelector('#kfz-fixed-order-form')) {
      buildOrderForm(section);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(function () { observer.disconnect(); initialise(); }, 10000);
})();
