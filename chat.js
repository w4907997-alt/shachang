/* ================= chat.js ================= */
/* 聊天式记账：输入文字 → 解析 → 确认开单 */

/* ---------- 发送消息 ---------- */

function sendChatMessage() {
    var input = document.getElementById('chat-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';

    addChatBubble(text, 'user');
    parseOrderText(text);
}

/* ---------- 添加聊天气泡 ---------- */

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
/* ---------- 转义正则特殊字符 ---------- */

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ---------- 解析订单文本（核心） ---------- */

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

            // 1. 提取电话（11位手机号）
            var phoneMatch = remaining.match(/1[3-9]\d{9}/);
            if (phoneMatch) {
                result.phone = phoneMatch[0];
                remaining = remaining.replace(phoneMatch[0], ' ');
            }

            // 2. 提取产品和数量（按名称长度倒序，防止短名误匹配）
            var sorted = products.slice().sort(function(a, b) {
                return b.name.length - a.name.length;
            });

            for (var i = 0; i < sorted.length; i++) {
                var p = sorted[i];
                var eName = escapeRegex(p.name);
                var qty = 0;
                var matched = false;

                // 先试：产品名+数量（水泥20）
                var m1 = remaining.match(new RegExp(eName + '\\s*(\\d+\\.?\\d*)'));
                if (m1 && m1[1]) {
                    qty = parseFloat(m1[1]);
                    remaining = remaining.replace(m1[0], ' ');
                    matched = true;
                }

                if (!matched) {
                    // 再试：数量+产品名（20水泥）
                    var m2 = remaining.match(new RegExp('(\\d+\\.?\\d*)\\s*' + eName));
                    if (m2 && m2[1]) {
                        qty = parseFloat(m2[1]);
                        remaining = remaining.replace(m2[0], ' ');
                        matched = true;
                    }
                }

                if (!matched) {
                    // 只有产品名没数量，默认1
                    if (remaining.indexOf(p.name) >= 0) {
                        qty = 1;
                        remaining = remaining.replace(p.name, ' ');
                        matched = true;
                    }
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

            // 4. 用电话匹配客户
            if (!result.customerId && result.phone) {
                for (var k = 0; k < customers.length; k++) {
                    if (customers[k].phone === result.phone) {
                        result.customer = customers[k].name;
                        result.customerId = customers[k].id;
                        break;
                    }
                }
            }

            // 5. 剩余文本当地址
            remaining = remaining.replace(/[送到帮我去往]/g, '').replace(/\s+/g, ' ').trim();
            if (remaining.length > 0 && remaining.length < 50) {
                result.address = remaining;
            }

            showParseResult(result);
        });
    });
}

/* ---------- 显示解析结果 ---------- */

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

    if (result.customer) {
        html += '<div style="margin-top:6px;">客户：' + result.customer + '</div>';
    }
    if (result.address) {
        html += '<div>地址：' + result.address + '</div>';
    }
    if (result.phone && !result.customerId) {
        html += '<div>电话：' + result.phone + '</div>';
    }

    html += '<div style="margin-top:10px;">';
    html += '<button class="btn-primary" style="padding:8px 16px;font-size:14px;border-radius:6px;" onclick="confirmChatOrder()">确认开单</button>';
    html += '</div>';

    window._lastParseResult = result;
    addChatBubble(html, 'system');
}
/* ---------- 确认开单 → 打开收银台 ---------- */

function confirmChatOrder() {
    var result = window._lastParseResult;
    if (!result) return;

    openCashier({
        items: result.items,
        address: result.address || '',
        customerId: result.customerId || null
    });
}

/* ---------- 页面初始化 ---------- */

document.addEventListener('DOMContentLoaded', function() {

    // 发送按钮
    var sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendChatMessage);
    }

    // 回车发送
    var chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') sendChatMessage();
        });
    }

    // 在欢迎区加一个"手动开单"按钮
    var welcome = document.querySelector('.chat-welcome');
    if (welcome) {
        var btnP = document.createElement('p');
        btnP.style.marginTop = '12px';
        btnP.innerHTML = '<button class="btn-small" onclick="openCashier()" style="padding:8px 20px;">手动开单（收银台）</button>';
        welcome.appendChild(btnP);
    }

    // 接管"记账"Tab → 现在进聊天页而不是直接进收银台
    var _prevSwitchTab = switchTab;
    switchTab = function(tabName) {
        if (tabName === 'chat') {
            pageHistory = [];
            var pages = document.querySelectorAll('.page');
            for (var p = 0; p < pages.length; p++) {
                pages[p].classList.remove('active');
            }
            document.getElementById('page-chat').classList.add('active');
            currentPage = 'page-chat';

            var navs = document.querySelectorAll('.nav-item');
            for (var n = 0; n < navs.length; n++) {
                navs[n].classList.remove('active');
            }
            navs[1].classList.add('active');
            return;
        }
        _prevSwitchTab(tabName);
    };
});
