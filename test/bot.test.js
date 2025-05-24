const fs = require('fs');
const path = require('path');

describe('Felipe Bot - Configuração Básica', () => {
  test('store_info.json deve conter informações da loja', () => {
    const storeInfo = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/store_info.json')));
    expect(storeInfo.name).toBe('Felipe Relógios');
    expect(storeInfo.hours).toBeDefined();
    expect(storeInfo.address).toBeDefined();
    expect(storeInfo.contact).toBeDefined();
    expect(storeInfo.policies).toBeDefined();
  });

  test('states.json deve conter os estados do bot', () => {
    const states = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/states.json')));
    expect(states.START_STATE).toBeDefined();
    expect(states.CATALOG_STATE).toBeDefined();
    expect(states.STORE_INFO_STATE).toBeDefined();
  });

  test('states.json deve ter mensagens personalizadas para Felipe Relógios', () => {
    const states = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/states.json')));
    expect(states.START_STATE.message).toContain('Felipe Relógios');
    expect(states.CATALOG_STATE.message).toContain('Catálogo Felipe Relógios');
  });
});
