(function () {
  'use strict';

  var VERSION = '2026-08-11.1';
  var ENDPOINT = 'https://fn-kfz-zulassung-prod-260810-czaxc8chcze9eufb.germanywestcentral-01.azurewebsites.net/api/precheckout/intake';
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
    'adress-namens-aenderung': 'Adress-/Namensänderung'
  };

  function wait(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function getStatus(form) {
    return form.querySelector('#df-status') || document.getElementById('df-status');
  }

  function setStatus(form, text, kind) {
    var status = getStatus(form);
    if (!status) return;
    status.textContent = text;
    status.className = 'df-status' + (kind ? ' df-status--' + kind : '');
    status.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  }

  function getSubmitButton(form) {
    return form.querySelector('button[type="submit"], input[type="submit"]');
  }

  function setBusy(form, busy, label) {
    var submit = getSubmitButton(form);
    form.dataset.kfzOrderBusy = busy ? 'true' : 'false';
    form.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (!submit) return;
    if (!submit.dataset.kfzOriginalLabel) {
      submit.dataset.kfzOriginalLabel = submit.tagName === 'INPUT' ? submit.value : submit.textContent;
    }
    submit.disabled = !!busy;
    if (submit.tagName === 'INPUT') {
      submit.value = label || submit.dataset.kfzOriginalLabel;
    } else {
      submit.textContent = label || submit.dataset.kfzOriginalLabel;
    }
  }

  function normaliseIban(form) {
    var iban = form.elements && form.elements.iban;
    if (!iban) return;
    iban.value = String(iban.value || '').replace(/\s+/g, '').toUpperCase();
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
  }

  function readJson(response) {
    return response.text().then(function (text) {
      if (!text) return {};
      try {
        return JSON.parse(text);
      } catch (_error) {
        return { message: text.slice(0, 400) };
      }
    });
  }

  function requestWithTimeout(url, options, timeoutMs) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;
    var requestOptions = Object.assign({}, options || {});
    if (controller) {
      requestOptions.signal = controller.signal;
      timer = window.setTimeout(function () {
        controller.abort();
      }, timeoutMs);
    }
    return fetch(url, requestOptions).finally(function () {
      if (timer) window.clearTimeout(timer);
    });
  }

  function UploadInputError(message) {
    this.name = 'UploadInputError';
    this.message = message || 'Bitte prüfe deine Angaben und Dateien.';
  }
  UploadInputError.prototype = Object.create(Error.prototype);

  function uploadDocuments(form) {
    var payload = new FormData(form);
    return requestWithTimeout(
      ENDPOINT,
      {
        method: 'POST',
        body: payload,
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      },
      25000
    ).then(function (response) {
      return readJson(response).then(function (result) {
        if ([400, 413, 415, 422].indexOf(response.status) !== -1) {
          throw new UploadInputError(result.message || 'Bitte prüfe deine Angaben und die hochgeladenen Dateien.');
        }
        if (!response.ok) {
          throw new Error(result.message || 'Sicherer Upload vorübergehend nicht erreichbar.');
        }
        if (!result.accepted || !isUuid(result.caseReference)) {
          throw new Error('Die Upload-Bestätigung war unvollständig.');
        }
        return result.caseReference;
      });
    });
  }

  function addOrderToCart(variantId, properties) {
    return fetch('/cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        items: [
          {
            id: Number(variantId),
            quantity: 1,
            properties: properties
          }
        ]
      })
    }).then(function (response) {
      return readJson(response).then(function (result) {
        if (!response.ok) {
          throw new Error(result.description || result.message || 'Der Warenkorb konnte nicht vorbereitet werden.');
        }
        return result;
      });
    });
  }

  function buildProperties(service, caseReference, uploadDeferred) {
    var properties = {
      Zulassungsvorgang: TITLES[service] || service,
      Unterlagenstatus: uploadDeferred ? 'Sicherer Upload nach Bestellung erforderlich' : 'Sicher in Azure gespeichert',
      'Bestellablauf-Version': VERSION
    };
    if (caseReference) {
      properties['Sicherer Vorgang'] = caseReference;
    } else {
      properties['Sicherer Vorgang'] = 'Nach Bestellung anlegen';
    }
    return properties;
  }

  function redirectToCheckout() {
    window.location.assign('/checkout');
  }

  async function handleDigitalOrder(form) {
    if (form.dataset.kfzOrderBusy === 'true') return;

    normaliseIban(form);
    if (!form.reportValidity()) return;

    var service = form.elements && form.elements.service ? form.elements.service.value : '';
    var variantId = VARIANTS[service];
    if (!variantId) {
      setStatus(form, 'Bitte wähle den passenden Zulassungsvorgang.', 'error');
      return;
    }

    setBusy(form, true, 'Unterlagen werden sicher geprüft …');
    setStatus(form, 'Sichere Unterlagenübermittlung wird geprüft …', 'info');

    var caseReference = '';
    var uploadDeferred = false;

    try {
      caseReference = await uploadDocuments(form);
      setStatus(form, 'Unterlagen sicher gespeichert. Der Checkout wird vorbereitet …', 'ok');
    } catch (error) {
      if (error && error.name === 'UploadInputError') {
        setStatus(form, error.message, 'error');
        setBusy(form, false);
        return;
      }

      uploadDeferred = true;
      console.warn('[Kfz-Bestellablauf] Azure-Upload nicht erreichbar; sicherer Nachreichungsweg wird verwendet.', error);
      setStatus(
        form,
        'Die sichere Upload-Strecke ist vorübergehend nicht erreichbar. Deine ausgewählten Dateien wurden nicht gespeichert. Die Bestellung funktioniert trotzdem. Nach dem Checkout fordern wir die Unterlagen über einen sicheren Yousign-Link an.',
        'warning'
      );
      await wait(1600);
    }

    try {
      await addOrderToCart(variantId, buildProperties(service, caseReference, uploadDeferred));
      setStatus(
        form,
        uploadDeferred
          ? 'Bestellung vorbereitet. Der Checkout wird geöffnet; die Unterlagen fordern wir anschließend sicher an …'
          : 'Bestellung vorbereitet. Der sichere Checkout wird geöffnet …',
        'ok'
      );
      await wait(250);
      redirectToCheckout();
    } catch (error) {
      console.error('[Kfz-Bestellablauf] Warenkorbfehler', error);
      setStatus(form, error && error.message ? error.message : 'Der Checkout konnte nicht vorbereitet werden. Bitte versuche es erneut.', 'error');
      setBusy(form, false);
    }
  }

  document.addEventListener(
    'submit',
    function (event) {
      var form = event.target && event.target.closest ? event.target.closest('#df-intake-form') : null;
      if (!form) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      handleDigitalOrder(form);
    },
    true
  );

  function markInstalled() {
    document.documentElement.setAttribute('data-kfz-order-fix', VERSION);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markInstalled, { once: true });
  } else {
    markInstalled();
  }
})();
