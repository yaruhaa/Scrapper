const fs = require('fs');

// Читання вихідних даних із файлу modify_products.json
fs.readFile('../modify/modify_products.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading modify_products.json:', err);
        return;
    }

    const input = JSON.parse(data);

    // Функція для групування продуктів
    function groupProducts(data) {
        const result = {};

        for (const category in data) {
            if (!result[category]) result[category] = [];

            for (const subcategory in data[category]) {
                const grouped = {};

                data[category][subcategory].forEach(product => {
                    const key = `${product.type}-${product.weight}-${product.firm}-${product.flavor}-${product.sort}`;

                    if (!grouped[key]) {
                        grouped[key] = {
                            MainInfo: {
                                type: product.type,
                                firm: product.firm,
                                flavor: product.flavor,
                                weight: product.weight,
                                sort: product.sort,
                                OtherInfo: []
                            }
                        };
                    }

                    grouped[key].MainInfo.OtherInfo.push({
                        storeName: product.storeName,
                        productImg: product.productImg,
                        productLink: product.productLink,
                        productPrice: product.productPrice
                    });
                });

                const subcategoryObject = {};
                subcategoryObject[subcategory] = Object.values(grouped);
                result[category].push(subcategoryObject);
            }
        }
        return result;
    }

    // Групування продуктів
    const output = groupProducts(input);

    // Запис згрупованих даних у файл group_products.json
    fs.writeFile('group_products.json', JSON.stringify(output, null, 2), 'utf8', err => {
        if (err) {
            console.error('Error writing to group_products.json:', err);
        } else {
            console.log('Successfully wrote to group_products.json');
        }
    });
});
