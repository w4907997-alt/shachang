/* ==================== 数据库初始化 ==================== */

var db = null;
var DB_NAME = 'ShaChangDB';
var DB_VERSION = 1;

function initDB(callback) {
    var request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = function(event) {
        console.error('数据库打开失败', event);
        showToast('数据库打开失败');
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log('数据库打开成功');
        // 检查是否需要预置产品数据
        checkAndInitProducts(function() {
            if (callback) callback();
        });
    };

    request.onupgradeneeded = function(event) {
        var database = event.target.result;
        console.log('数据库升级/创建');

        // 产品表
        if (!database.objectStoreNames.contains('products')) {
            var productStore = database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
            productStore.createIndex('name', 'name', { unique: false });
        }

        // 客户表
        if (!database.objectStoreNames.contains('customers')) {
            var customerStore = database.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
            customerStore.createIndex('name', 'name', { unique: false });
            customerStore.createIndex('phone', 'phone', { unique: false });
        }

        // 客户地址表
        if (!database.objectStoreNames.contains('customerAddresses')) {
            var addrStore = database.createObjectStore('customerAddresses', { keyPath: 'id', autoIncrement: true });
            addrStore.createIndex('customerId', 'customerId', { unique: false });
        }

        // 客户专属单价表
        if (!database.objectStoreNames.contains('customerPrices')) {
            var priceStore = database.createObjectStore('customerPrices', { keyPath: 'id', autoIncrement: true });
            priceStore.createIndex('customerId', 'customerId', { unique: false });
            priceStore.createIndex('productId', 'productId', { unique: false });
        }

        // 订单表
        if (!database.objectStoreNames.contains('orders')) {
            var orderStore = database.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
            orderStore.createIndex('customerId', 'customerId', { unique: false });
            orderStore.createIndex('date', 'date', { unique: false });
            orderStore.createIndex('settled', 'settled', { unique: false });
        }

        // 订单明细表
        if (!database.objectStoreNames.contains('orderItems')) {
            var itemStore = database.createObjectStore('orderItems', { keyPath: 'id', autoIncrement: true });
            itemStore.createIndex('orderId', 'orderId', { unique: false });
        }

        // 聊天消息表
        if (!database.objectStoreNames.contains('chatMessages')) {
            var chatStore = database.createObjectStore('chatMessages', { keyPath: 'id', autoIncrement: true });
            chatStore.createIndex('date', 'date', { unique: false });
        }

        // 系统配置表
        if (!database.objectStoreNames.contains('systemConfig')) {
            database.createObjectStore('systemConfig', { keyPath: 'key' });
        }
    };
}
/* ==================== 预置产品数据 ==================== */

var DEFAULT_PRODUCTS = [
    { name: '黄沙', unit: '袋', price: 4.80, sortOrder: 1 },
    { name: '水泥', unit: '袋', price: 25.00, sortOrder: 2 },
    { name: '大砖', unit: '块', price: 4.50, sortOrder: 3 },
    { name: '小砖', unit: '块', price: 0.50, sortOrder: 4 },
    { name: '陶粒', unit: '包', price: 20.00, sortOrder: 5 },
    { name: '钢网', unit: '个', price: 30.00, sortOrder: 6 },
    { name: '1.2过桥', unit: '根', price: 10.00, sortOrder: 7 },
    { name: '1.5过桥', unit: '根', price: 20.00, sortOrder: 8 },
    { name: '2过桥', unit: '根', price: 35.00, sortOrder: 9 },
    { name: '75大砖', unit: '块', price: 4.00, sortOrder: 10 },
    { name: '8公分大砖', unit: '块', price: 4.00, sortOrder: 11 },
    { name: '水泥4楼搬运费', unit: '/', price: 4.00, sortOrder: 12 },
    { name: '黄沙4楼搬运费', unit: '/', price: 2.00, sortOrder: 13 },
    { name: '其他', unit: '项', price: 0, sortOrder: 99 }
];

function checkAndInitProducts(callback) {
    var tx = db.transaction('products', 'readonly');
    var store = tx.objectStore('products');
    var countReq = store.count();
    countReq.onsuccess = function() {
        if (countReq.result === 0) {
            // 没有产品数据，插入预置数据
            var wtx = db.transaction('products', 'readwrite');
            var wstore = wtx.objectStore('products');
            for (var i = 0; i < DEFAULT_PRODUCTS.length; i++) {
                wstore.add(DEFAULT_PRODUCTS[i]);
            }
            wtx.oncomplete = function() {
                console.log('预置产品数据已插入');
                if (callback) callback();
            };
        } else {
            if (callback) callback();
        }
    };
}
/* ==================== 通用数据库操作 ==================== */

// 添加一条记录
function dbAdd(storeName, data, callback) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);
    var request = store.add(data);
    request.onsuccess = function(e) {
        if (callback) callback(e.target.result); // 返回新记录的id
    };
    request.onerror = function(e) {
        console.error('添加失败', storeName, e);
        if (callback) callback(null);
    };
}

// 更新一条记录
function dbUpdate(storeName, data, callback) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);
    var request = store.put(data);
    request.onsuccess = function() {
        if (callback) callback(true);
    };
    request.onerror = function(e) {
        console.error('更新失败', storeName, e);
        if (callback) callback(false);
    };
}

// 删除一条记录
function dbDelete(storeName, id, callback) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);
    var request = store.delete(id);
    request.onsuccess = function() {
        if (callback) callback(true);
    };
    request.onerror = function(e) {
        console.error('删除失败', storeName, e);
        if (callback) callback(false);
    };
}

// 根据id获取一条记录
function dbGet(storeName, id, callback) {
    var tx = db.transaction(storeName, 'readonly');
    var store = tx.objectStore(storeName);
    var request = store.get(id);
    request.onsuccess = function(e) {
        if (callback) callback(e.target.result || null);
    };
    request.onerror = function() {
        if (callback) callback(null);
    };
}

// 获取所有记录
function dbGetAll(storeName, callback) {
    var tx = db.transaction(storeName, 'readonly');
    var store = tx.objectStore(storeName);
    var request = store.getAll();
    request.onsuccess = function(e) {
        if (callback) callback(e.target.result || []);
    };
    request.onerror = function() {
        if (callback) callback([]);
    };
}

// 根据索引查询多条记录
function dbGetByIndex(storeName, indexName, value, callback) {
    var tx = db.transaction(storeName, 'readonly');
    var store = tx.objectStore(storeName);
    var index = store.index(indexName);
    var request = index.getAll(value);
    request.onsuccess = function(e) {
        if (callback) callback(e.target.result || []);
    };
    request.onerror = function() {
        if (callback) callback([]);
    };
}

// 根据索引删除多条记录
function dbDeleteByIndex(storeName, indexName, value, callback) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);
    var index = store.index(indexName);
    var request = index.openCursor(value);
    request.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) {
            cursor.delete();
            cursor.continue();
        }
    };
    tx.oncomplete = function() {
        if (callback) callback(true);
    };
    tx.onerror = function() {
        if (callback) callback(false);
    };
}

// 清空一个表
function dbClear(storeName, callback) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);
    var request = store.clear();
    request.onsuccess = function() {
        if (callback) callback(true);
    };
    request.onerror = function() {
        if (callback) callback(false);
    };
}
/* ==================== 辅助函数 ==================== */

// 获取当前时间字符串（年-月-日 时:分）
function getNowString() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hour = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return year + '-' + month + '-' + day + ' ' + hour + ':' + min;
}

// 获取今天的日期字符串（年-月-日）
function getTodayString() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

// 获取本月第一天
function getMonthStartString() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    return year + '-' + month + '-01';
}

// 金额格式化
function formatMoney(num) {
    num = parseFloat(num) || 0;
    return '¥' + num.toFixed(2);
}

// 数字转中文大写金额
function moneyToChinese(num) {
    num = parseFloat(num) || 0;
    if (num === 0) return '零元整';
    var digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    var units = ['', '拾', '佰', '仟'];
    var bigUnits = ['', '万', '亿'];
    var intPart = Math.floor(Math.abs(num));
    var decPart = Math.round((Math.abs(num) - intPart) * 100);
    var result = '';

    if (intPart === 0) {
        result = '零';
    } else {
        var intStr = String(intPart);
        var groups = [];
        while (intStr.length > 0) {
            groups.unshift(intStr.slice(-4));
            intStr = intStr.slice(0, -4);
        }
        for (var g = 0; g < groups.length; g++) {
            var group = groups[g];
            var groupResult = '';
            var hasZero = false;
            for (var i = 0; i < group.length; i++) {
                var d = parseInt(group[i]);
                var unitIdx = group.length - 1 - i;
                if (d === 0) {
                    hasZero = true;
                } else {
                    if (hasZero) {
                        groupResult += '零';
                        hasZero = false;
                    }
                    groupResult += digits[d] + units[unitIdx];
                }
            }
            if (groupResult) {
                result += groupResult + bigUnits[groups.length - 1 - g];
            }
        }
    }

    result += '元';

    if (decPart === 0) {
        result += '整';
    } else {
        var jiao = Math.floor(decPart / 10);
        var fen = decPart % 10;
        if (jiao > 0) result += digits[jiao] + '角';
        if (fen > 0) result += digits[fen] + '分';
    }

    return result;
}

// 生成单号（7位，自动递增）
function generateOrderNo(callback) {
    dbGetAll('orders', function(orders) {
        var maxNo = 0;
        for (var i = 0; i < orders.length; i++) {
            var no = parseInt(orders[i].orderNo) || 0;
            if (no > maxNo) maxNo = no;
        }
        var newNo = String(maxNo + 1).padStart(7, '0');
        callback(newNo);
    });
}
