const fs = require('fs');
const path = require('path');

const loadStoreData = () => {
    const filePath = path.join(__dirname, '..', 'data', 'store_info.json');
    const rawData = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawData);
};

const getStoreInfo = () => {
    const data = loadStoreData();
    return data.storeInfo;
};

const getAllProducts = () => {
    const data = loadStoreData();
    return data.products;
};

const getProductById = (productId) => {
    const data = loadStoreData();
    return data.products.find(product => product.id === productId);
};

const getProductsByCategory = (category) => {
    const data = loadStoreData();
    return data.products.filter(product => 
        product.category.toLowerCase() === category.toLowerCase()
    );
};

const formatPrice = (price) => {
    return price.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
};

const formatProductInfo = (product) => {
    return `*${product.name}*\n` +
           `💰 Preço: ${formatPrice(product.price)}\n` +
           `📝 Características:\n${product.characteristics.map(c => `• ${c}`).join('\n')}\n` +
           `👥 Ideal para: ${product.idealFor}`;
};

module.exports = {
    getStoreInfo,
    getAllProducts,
    getProductById,
    getProductsByCategory,
    formatProductInfo,
    formatPrice
};
