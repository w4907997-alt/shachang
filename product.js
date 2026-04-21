/* ================= 产品管理 ================= */

// 加载产品列表
function loadProductList() {
    if (!db) {
        setTimeout(loadProductList, 300);
        return;
    }
    dbGetAll('products', function(products) {
        var container = document.getElementById('product-list');
        if (products.length === 0) {
            container.innerHTML = '<div class="empty-tip">暂无产品，点右上角 + 添加</div>';
            return;
        }

        // 按sortOrder排序
        products.sort(function(a, b) {
            return (a.sortOrder || 999) - (b.sortOrder || 999);
        });

        var html = '';
        for (var i = 0; i < products.length; i++) {
            var p = products[i];
            var priceText = p.price > 0 ? formatMoney(p.price) + '/' + p.unit : '手动输入';
            html += '<div class="product-item">';
            html += '  <div>';
            html += '    <div class="product-name">' + p.name + '</div>';
            html += '    <div class="product-info">' + priceText + '</div>';
            html += '  </div>';
            html += '  <div class="product-actions">';
            html += '    <button onclick="showEditProduct(' + p.id + ')">编辑</button>';
            html += '    <button class="btn-delete" onclick="deleteProduct(' + p.id + ', \'' + p.name + '\')">删除</button>';
            html += '  </div>';
            html += '</div>';
        }
        container.innerHTML = html;
    });
}
// 显示新增产品弹窗
function showAddProduct() {
    var bodyHTML = '';
    bodyHTML += '<div class="form-section">';
    bodyHTML += '  <label class="form-label">产品名称 <span class="required">*必填</span></label>';
    bodyHTML += '  <input type="text" class="form-input" id="product-name-input" placeholder="输入产品名称" />';
    bodyHTML += '</div>';
    bodyHTML += '<div class="form-section">';
    bodyHTML += '  <label class="form-label">单位</label>';
    bodyHTML += '  <input type="text" class="form-input" id="product-unit-input" placeholder="如：袋、块、根" />';
    bodyHTML += '</div>';
    bodyHTML += '<div class="form-section">';
    bodyHTML += '  <label class="form-label">默认单价</label>';
    bodyHTML += '  <input type="number" class="form-input" id="product-price-input" placeholder="输入默认单价" />';
    bodyHTML += '</div>';

    var footerHTML = '';
    footerHTML += '<button class="btn-secondary" onclick="closeModal()">取消</button>';
    footerHTML += '<button class="btn-primary" onclick="saveNewProduct()">保存</button>';

    showModal('新增产品', bodyHTML, footerHTML);
}

// 保存新产品
function saveNewProduct() {
    var name = document.getElementById('product-name-input').value.trim();
    var unit = document.getElementById('product-unit-input').value.trim();
    var price = parseFloat(document.getElementById('product-price-input').value) || 0;

    if (!name) {
        showToast('请输入产品名称');
        return;
    }

    // 获取当前最大sortOrder
    dbGetAll('products', function(products) {
        var maxSort = 0;
        for (var i = 0; i < products.length; i++) {
            if ((products[i].sortOrder || 0) > maxSort && products[i].sortOrder < 99) {
                maxSort = products[i].sortOrder;
            }
        }

        var newProduct = {
            name: name,
            unit: unit || '个',
            price: price,
            sortOrder: maxSort + 1
        };

        dbAdd('products', newProduct, function(id) {
            if (id) {
                closeModal();
                showToast('产品添加成功');
                loadProductList();
            } else {
                showToast('添加失败');
            }
        });
    });
}
// 显示编辑产品弹窗
function showEditProduct(productId) {
    dbGet('products', productId, function(product) {
        if (!product) {
            showToast('产品不存在');
            return;
        }

        var bodyHTML = '';
        bodyHTML += '<div class="form-section">';
        bodyHTML += '  <label class="form-label">产品名称 <span class="required">*必填</span></label>';
        bodyHTML += '  <input type="text" class="form-input" id="product-name-input" value="' + product.name + '" />';
        bodyHTML += '</div>';
        bodyHTML += '<div class="form-section">';
        bodyHTML += '  <label class="form-label">单位</label>';
        bodyHTML += '  <input type="text" class="form-input" id="product-unit-input" value="' + (product.unit || '') + '" />';
        bodyHTML += '</div>';
        bodyHTML += '<div class="form-section">';
        bodyHTML += '  <label class="form-label">默认单价</label>';
        bodyHTML += '  <input type="number" class="form-input" id="product-price-input" value="' + (product.price || '') + '" />';
        bodyHTML += '</div>';

        var footerHTML = '';
        footerHTML += '<button class="btn-secondary" onclick="closeModal()">取消</button>';
        footerHTML += '<button class="btn-primary" onclick="saveEditProduct(' + product.id + ')">保存</button>';

        showModal('编辑产品', bodyHTML, footerHTML);
    });
}

// 保存编辑后的产品
function saveEditProduct(productId) {
    var name = document.getElementById('product-name-input').value.trim();
    var unit = document.getElementById('product-unit-input').value.trim();
    var price = parseFloat(document.getElementById('product-price-input').value) || 0;

    if (!name) {
        showToast('请输入产品名称');
        return;
    }

    dbGet('products', productId, function(product) {
        product.name = name;
        product.unit = unit || '个';
        product.price = price;

        dbUpdate('products', product, function(ok) {
            if (ok) {
                closeModal();
                showToast('产品修改成功');
                loadProductList();
            } else {
                showToast('修改失败');
            }
        });
    });
}

// 删除产品
function deleteProduct(productId, productName) {
    showConfirm('删除产品', '确定要删除「' + productName + '」吗？删除后不影响历史订单。', function() {
        dbDelete('products', productId, function(ok) {
            if (ok) {
                showToast('已删除');
                loadProductList();
            } else {
                showToast('删除失败');
            }
        });
    });
}

// 进入产品管理页面时自动加载列表
var _origShowPage = showPage;
showPage = function(pageId) {
    _origShowPage(pageId);
    if (pageId === 'page-products') {
        loadProductList();
    }
};
