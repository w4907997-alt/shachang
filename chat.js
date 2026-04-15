/* ================= chat.js ================= */
/* 聊天式记账：输入文字 → 解析 → 确认开单 */

function sendChatMessage() {
    var input = document.getElementById('chat-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    addChatBubble(text, 'user');
    parseOrderText(text);
}

function addChatBubble(content, type) {
    var container = document.getElementById('chat-messages');
    var welcome = container.querySelector('.chat-welcome');
    if (welcome) welcome.style.display = 'none';

    var timeDiv = document.createElement('div');
    timeDiv.className = 'chat-time';
    timeDiv.textContent = getNowString();
    container.appendChild(timeDiv);

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + type;
    bubble.innerHTML = content;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/* ---------- 解析订单文本 ---------- */

function parseOrderText(text) {
    dbGetAll('products', function(products) {
        dbGetAll('customers', function(customers) {
            var result = {
                items: [],
                customer: null,
                customerId: null,
                phone: null,
                address: ''
            };
            var remaining = text;

            // 1. 提取手机号
            var phoneMatch = remaining.match(/1[3-9]\d{9}/);
            if (phoneMatch) {
                result.phone = phoneMatch[0];
                remaining = remaining.replace(phoneMatch[0], ' ');
            }

            // 2. 提取产品和数量（名称长的优先匹配）
            var sorted = products.slice().sort(function(a, b) {
                return b.name.length - a.name.length;
            });

            for (var i = 0; i < sorted.length; i++) {
                var p = sorted[i];
                if (p.name.length < 2) continue;
                var eName = escapeRegex(p.name);
                var qty = 0;
                var matched = false;

                var m1 = remaining.match(new RegExp(eName + '\\s*(\\d+\\.?\\d*)'));
                if (m1 && m1[1]) {
                    qty = parseFloat(m1[1]);
                    remaining = remaining.replace(m1[0], ' ');
                    matched = true;
                }
                if (!matched) {
                    var m2 = remaining.match(new RegExp('(\\d+\\.?\\d*)\\s*' + eName));
                    if (m2 && m2[1]) {
                        qty = parseFloat(m2[1]);
                        remaining = remaining.replace(m2[0], ' ');
                        matched = true;
                    }
                }
                if (!matched && remaining.indexOf(p.name) >= 0) {
                    qty = 1;
                    remaining = remaining.replace(p.name, ' ');
                    matched = true;
                }
                if (matched) {
                    result.items.push({
                        productId: p.id,
                        productName: p.name,
                        quantity: qty,
                        price: p.price || 0,
                        unit: p.unit || ''
                    });
                }
            }
            // 3. 匹配客户姓名
            var cSorted = customers.slice().sort(function(a, b) {
                return b.name.length - a.name.length;
            });
            for (var j = 0; j < cSorted.length; j++) {
                if (remaining.indexOf(cSorted[j].name) >= 0) {
                    result.customer = cSorted[j].name;
                    result.customerId = cSorted[j].id;
                    remaining = remaining.replace(cSorted[j].name, ' ');
                    break;
                }
            }

            // 4. 电话匹配客户
            if (!result.customerId && result.phone) {
                for (var k = 0; k < customers.length; k++) {
                    if (customers[k].phone === result.phone) {
                        result.customer = customers[k].name;
                        result.customerId = customers[k].id;
                        break;
                    }
                }
            }

            // 5. 剩余文字当地址
            remaining = remaining.replace(/[送到帮我去往]/g, '').replace(/\s+/g, ' ').trim();
            if (remaining.length > 0 && remaining.length < 50) {
                result.address = remaining;
            }

            showParseResult(result);
        });
    });
}

function showParseResult(result) {
    if (result.items.length === 0) {
        addChatBubble('没有识别出商品哦～<br/>请输入产品名称和数量<br/>例如：水泥20 黄沙15', 'system');
        return;
    }
    var html = '<div style="margin-bottom:8px;font-weight:600;">识别结果：</div>';
    for (var i = 0; i < result.items.length; i++) {
        var item = result.items[i];
        html += '<div>' + item.productName + ' × ' + item.quantity + ' ' + item.unit + '</div>';
    }
    if (result.customer) html += '<div style="margin-top:6px;">客户：' + result.customer + '</div>';
    if (result.address) html += '<div>地址：' + result.address + '</div>';
    if (result.phone && !result.customerId) html += '<div>电话：' + result.phone + '</div>';
    html += '<div style="margin-top:10px;">';
    html += '<button class="btn-primary" style="padding:8px 16px;font-size:14px;border-radius:6px;" onclick="confirmChatOrder()">确认开单</button>';
    html += '</div>';
    window._lastParseResult = result;
    addChatBubble(html, 'system');
}
/* ---------- 确认开单 ---------- */

function confirmChatOrder() {
    var result = window._lastParseResult;
    if (!result) return;
    window._chatOrderPending = true;
    openCashier({
        items: result.items,
        address: result.address || '',
        customerId: result.customerId || null
    });
}

/* ---------- 页面初始化 ---------- */

document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('chat-send-btn').addEventListener('click', sendChatMessage);
    document.getElementById('chat-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendChatMessage();
    });

    // 输入栏旁加"开单"按钮
    var inputArea = document.querySelector('.chat-input-area');
    if (inputArea) {
        var btn = document.createElement('button');
        btn.className = 'btn-small';
        btn.textContent = '开单';
        btn.style.cssText = 'margin-right:6px;min-height:40px;';
        btn.onclick = function() { openCashier(); };
        inputArea.insertBefore(btn, inputArea.firstChild);
    }

    // 保存订单后回到聊天页时自动发消息
    var chatPage = document.getElementById('page-chat');
    if (chatPage) {
        new MutationObserver(function() {
            if (chatPage.classList.contains('active') && window._chatOrderPending) {
                window._chatOrderPending = false;
                setTimeout(function() {
                    addChatBubble('订单保存成功！', 'system');
                }, 300);
            }
        }).observe(chatPage, { attributes: true, attributeFilter: ['class'] });
    }

    // 接管"记账"Tab
    var _prevSwitchTab = switchTab;
    switchTab = function(tabName) {
        if (tabName === 'chat') {
            pageHistory = [];
            var pages = document.querySelectorAll('.page');
            for (var p = 0; p < pages.length; p++) pages[p].classList.remove('active');
            document.getElementById('page-chat').classList.add('active');
            currentPage = 'page-chat';
            var navs = document.querySelectorAll('.nav-item');
            for (var n = 0; n < navs.length; n++) navs[n].classList.remove('active');
            navs[1].classList.add('active');
            return;
        }
        _prevSwitchTab(tabName);
    };
});
