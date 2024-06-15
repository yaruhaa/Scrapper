const fs = require('fs');

// Загрузка данных
const typesData = require('./Dictionaries/type.json');
const firmsData = require('./Dictionaries/firm.json');
const flavorsData = require('./Dictionaries/flavor.json');
const sortsData = require('./Dictionaries/variety.json');

// Функция для удаления ненужного из названия продукта
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
    const gramMatch = productName.match(/(\d+(?:[.,]\d+)?)\s*г/);
    const kilogramMatch = productName.match(/(\d+(?:[.,]\d+)?)\s*кг/);
    const plusMatch = productName.match(/(\d+)\s*\+\s*(\d+)\s*г/);
    const kgOnlyMatch = productName.match(/кг/);
    const pieceMatch = productName.match(/(\d+)\s*шт/);

    if (plusMatch) {
        const firstNumber = parseInt(plusMatch[1]);
        const secondNumber = parseInt(plusMatch[2]);
        return firstNumber + secondNumber;
    } else if (gramMatch) {
        return parseFloat(gramMatch[1].replace(',', '.'));
    } else if (kilogramMatch) {
        return parseFloat(kilogramMatch[1].replace(',', '.')) * 1000;
    } else if (kgOnlyMatch) {
        return 1000;
    } else if (pieceMatch) {
        return `${pieceMatch[1]} шт`;
    } else {
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
            // Преобразование строки цены в число и обратно в строку для унифицированного формата
            product.productPrice = parseFloat(product.productPrice).toFixed(2);
        }
        if (product.productDiscountPrice) {
            if (product.storeName === "FOZZY") {
                product.productDiscountPrice = product.productDiscountPrice.replace(/\u00A0/g, " ").replace(/ грн$/, "").replace(/,/g, ".").replace(/\s/g, "");
            }
            if (product.storeName === "MAUDAU") {
                product.productDiscountPrice = product.productDiscountPrice.replace(/\u00A0/g, " ").replace(/ ₴$/, "");
            }
            // Преобразование строки цены в число и обратно в строку для унифицированного формата
            product.productDiscountPrice = parseFloat(product.productDiscountPrice).toFixed(2);
        }
        const weight = extractWeight(product.productName);
        // Если вес не найден, устанавливаем его в 1000 грамм
        if (weight !== null) {
            product.weight = weight;
        } else {
            product.weight = 1000;
        }
    });
}

// Чтение данных из products.json
fs.readFile('../scrapper/products.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Ошибка чтения файла:', err);
        return;
    }

    try {
        const productsData = JSON.parse(data);
        let allProducts = [];

        // Преобразование данных в общий массив продуктов с двухуровневой категорией
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

        // Удаление ненужных строк из названий продуктов
        allProducts.forEach(product => {
            product.productName = removeUnwantedStrings(product.productName);
        });

        // Применение функции обработки цен и веса
        processPricesAndWeight(allProducts);

        // Создание стандартизированных объектов данных
        const standardizedTypes = standardizeData(typesData);
        const standardizedFirms = standardizeData(firmsData);
        const standardizedFlavors = standardizeData(flavorsData);
        const standardizedSorts = standardizeData(sortsData);

        // Добавление отделения типа товара, фирмы, вкуса и сорта от названия
        allProducts.forEach(product => {
            const category = product.subCategory || 'Другое';

            // Проверка, существует ли категория в словарях
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

        // Преобразование данных обратно в формат с двухуровневыми категориями
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

        // Запись результатов в modify_products.json
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