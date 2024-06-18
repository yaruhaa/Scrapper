const fs = require('fs');

// Загрузка данних
const typesData = require('./Dictionaries/type.json');
const firmsData = require('./Dictionaries/firm.json');
const flavorsData = require('./Dictionaries/flavor.json');
const sortsData = require('./Dictionaries/variety.json');

// Функція для видалення непотрібного
function removeUnwantedStrings(productName) {
    return productName.replace(/\b\d+\s*гат\b/gi, '').replace(/№\d+/g, '').replace(/\s{2,}/g, ' ').trim();
}

// Функция для стандартизации данных с учетом категорий
function standardizeData(data) {
    const standardizedData = {};
    for (const category in data) {
        if (data.hasOwnProperty(category)) {
            standardizedData[category] = {};
            data[category].forEach(item => {
                const attribute = item.type || item.sort;
                const variants = item.variants;
                if (!standardizedData[category][attribute]) {
                    standardizedData[category][attribute] = [];
                }
                standardizedData[category][attribute].push(...variants);
            });
        }
    }
    return standardizedData;
}

// Функция для отделения типа, фирмы, вкуса или сорта от названия продукта с учетом категории
function separateAttributeFromName(productName, attributeData, category) {
    const attributesForCategory = attributeData[category];
    if (attributesForCategory) {
        for (const attribute in attributesForCategory) {
            if (attributesForCategory.hasOwnProperty(attribute)) {
                const variants = attributesForCategory[attribute];
                for (const variant of variants) {
                    if (productName.toLowerCase().includes(variant.toLowerCase())) {
                        return { attribute: attribute, remainingName: productName };
                    }
                }
            }
        }
    }
    return { attribute: null, remainingName: productName };
}

// Функция для извлечения веса из названия продукта и копирования его в отдельное поле
function extractWeight(productName) {
    const kilogramMatch = productName.match(/(\d+(?:[.,]\d+)?)\s*кг/);
    const gramMatch = productName.match(/(\d+(?:[.,]\d+)?)\s*г/);
    const plusMatch = productName.match(/(\d+)\s*\+\s*(\d+)\s*г/);
    const kgOnlyMatch = productName.match(/кг/);
    const pieceMatch = productName.match(/(\d+)\s*шт/);
    const sht = productName.match(/шт/);
    const gatMatch = productName.match(/(\d+)\s*гат/);
    const gat = productName.match(/гат/);

    if (plusMatch) {
        const firstNumber = parseInt(plusMatch[1]);
        const secondNumber = parseInt(plusMatch[2]);
        return firstNumber + secondNumber;
    }
    else if (kilogramMatch) {
        return parseFloat(kilogramMatch[1].replace(',', '.')) * 1000;
    }
    else if (gatMatch) {
        return `${gatMatch[1]} шт`;
    }
    else if (gat) {
        return `1 шт`;
    }
    else if (gramMatch) {
        return parseFloat(gramMatch[1].replace(',', '.'));
    }
    else if (pieceMatch) {
        return `${pieceMatch[1]} шт`;
    }
    else if (sht) {
        return `1 шт`;
    }
    else if (kgOnlyMatch) {
        return 1000;
    }
    else {
        return null;
    }
}


// Функция обработки цен и веса
function processPricesAndWeight(products) {
    products.forEach(product => {
        if (product.productPrice) {
            if (product.storeName === "РОСТ") {
                product.productPrice = product.productPrice.replace(/\n/g, ".");
                product.productPrice = product.productPrice.replace(/\. грн$/, "");
            }
            if (product.storeName === "FOZZY") {
                product.productPrice = product.productPrice.replace(/\u00A0/g, " ").replace(/ грн$/, "").replace(/,/g, ".").replace(/\s/g, "");
            }
            if (product.storeName === "MAUDAU") {
                product.productPrice = product.productPrice.replace(/\u00A0/g, " ").replace(/ ₴$/, "");
            }
            product.productPrice = parseFloat(product.productPrice).toFixed(2);
        }
        if (product.productDiscountPrice) {
            if (product.storeName === "FOZZY") {
                product.productDiscountPrice = product.productDiscountPrice.replace(/\u00A0/g, " ").replace(/ грн$/, "").replace(/,/g, ".").replace(/\s/g, "");
            }
            if (product.storeName === "MAUDAU") {
                product.productDiscountPrice = product.productDiscountPrice.replace(/\u00A0/g, " ").replace(/ ₴$/, "");
            }
            product.productDiscountPrice = parseFloat(product.productDiscountPrice).toFixed(2);
        }
        const weight = extractWeight(product.productName);
        if (weight !== null) {
            product.weight = weight;
        } else {
            product.weight = 1000;
        }
    });
}

// Читання даних із products.json
fs.readFile('../scrapper/products.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Ошибка чтения файла:', err);
        return;
    }

    try {
        const productsData = JSON.parse(data);
        let allProducts = [];

        // Перетворення даних у загальний масив продуктів із дворівневою категорією
        for (const mainCategory in productsData) {
            if (productsData.hasOwnProperty(mainCategory)) {
                const subCategories = productsData[mainCategory];
                for (const subCategory in subCategories) {
                    if (subCategories.hasOwnProperty(subCategory)) {
                        const products = subCategories[subCategory];
                        products.forEach(product => {
                            product.mainCategory = mainCategory;
                            product.subCategory = subCategory;
                        });
                        allProducts = allProducts.concat(products);
                    }
                }
            }
        }

        // Видалення непотрібних рядків із назв продуктів
        allProducts.forEach(product => {
            product.productName = removeUnwantedStrings(product.productName);
        });

        // Застосування функції обробки цін і ваги
        processPricesAndWeight(allProducts);

        // Создание стандартизированных объектов данных
        const standardizedTypes = standardizeData(typesData);
        const standardizedFirms = standardizeData(firmsData);
        const standardizedFlavors = standardizeData(flavorsData);
        const standardizedSorts = standardizeData(sortsData);

        // Додавання відокремлення типу товару, фірми, смаку та сорту від назви
        allProducts.forEach(product => {
            const category = product.subCategory || 'Другое';

            // Перевірка, чи існує категорія в словниках
            if (standardizedTypes[category] && standardizedFirms[category] && standardizedFlavors[category] && standardizedSorts[category]) {
                const { attribute: type } = separateAttributeFromName(product.productName, standardizedTypes, category);
                const { attribute: firm } = separateAttributeFromName(product.productName, standardizedFirms, category);
                const { attribute: flavor } = separateAttributeFromName(product.productName, standardizedFlavors, category);
                const { attribute: sort } = separateAttributeFromName(product.productName, standardizedSorts, category);

                product.type = type || 'Інше';
                product.firm = firm || 'Без фірми';
                product.flavor = flavor || 'Без вкуса';
                product.sort = sort || 'Без сорта';
            } else {
                product.type = 'Інше';
                product.firm = 'Без фірми';
                product.flavor = 'Без вкуса';
                product.sort = 'Без сорта';
            }
        });

        // Перетворення даних назад у формат із дворівневими категоріями
        const categorizedProducts = allProducts.reduce((acc, product) => {
            const mainCategory = product.mainCategory;
            const subCategory = product.subCategory;

            if (!acc[mainCategory]) {
                acc[mainCategory] = {};
            }
            if (!acc[mainCategory][subCategory]) {
                acc[mainCategory][subCategory] = [];
            }
            const { mainCategory: _, subCategory: __, ...rest } = product;
            acc[mainCategory][subCategory].push(rest);
            return acc;
        }, {});

        // Запис результатів в modify_products.json
        fs.writeFile('modify_products.json', JSON.stringify(categorizedProducts, null, 2), (err) => {
            if (err) {
                console.error('Ошибка записи в файл:', err);
                return;
            }
            console.log('Данные успешно записаны в modify_products.json');
        });
    } catch (err) {
        console.error('Ошибка парсинга JSON:', err);
    }
});
