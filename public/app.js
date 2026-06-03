const API_URL = 'http://localhost:3000/api';

// Simple tab navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove active class from all links
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        // Add active class to clicked link
        this.classList.add('active');
        
        // Hide all sections
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        // Show target section
        const target = this.getAttribute('data-tab');
        document.getElementById(target).classList.add('active');
        
        // Load data based on tab
        if (target === 'dashboard') {
            loadDashboard();
        } else if (target === 'inventory') {
            loadInventory();
        } else if (target === 'issue' || target === 'return') {
            loadDropdowns();
        }
    });
});

// Load Dashboard Data
function loadDashboard() {
    fetch(API_URL + '/stats')
        .then(res => res.json())
        .then(data => {
            document.getElementById('stat-total-components').innerText = data.total_components || 0;
            document.getElementById('stat-total-items').innerText = data.total_items || 0;
            document.getElementById('stat-available-items').innerText = data.available_items || 0;
        })
        .catch(err => console.error("Error fetching stats:", err));

    fetch(API_URL + '/transactions/recent')
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('recent-activity-body');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No transactions yet</td></tr>';
            } else {
                data.forEach(row => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${row.component_name}</td>
                        <td style="color: ${row.type === 'issue' ? 'red' : 'green'}; font-weight: bold;">${row.type.toUpperCase()}</td>
                        <td>${row.quantity}</td>
                        <td>${row.person_name}</td>
                        <td>${new Date(row.timestamp).toLocaleString()}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        })
        .catch(err => console.error("Error fetching transactions:", err));
}

// Load Inventory Table
function loadInventory() {
    fetch(API_URL + '/components')
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('inventory-body');
            tbody.innerHTML = '';
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No components found</td></tr>';
            } else {
                data.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.id}</td>
                        <td>${item.name}</td>
                        <td>${item.category}</td>
                        <td>${item.total_quantity}</td>
                        <td style="font-weight:bold; color: ${item.available_quantity > 0 ? 'green' : 'red'};">${item.available_quantity}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        })
        .catch(err => console.error("Error fetching inventory:", err));
}

// Load Dropdowns for Issue and Return forms
function loadDropdowns() {
    fetch(API_URL + '/components')
        .then(res => res.json())
        .then(data => {
            const options = '<option value="">-- Select --</option>' + 
                data.map(item => `<option value="${item.id}">${item.name} (Avail: ${item.available_quantity})</option>`).join('');
            
            document.getElementById('issue-component').innerHTML = options;
            document.getElementById('return-component').innerHTML = options;
        })
        .catch(err => console.error("Error fetching dropdowns:", err));
}

// Handle Add Component
document.getElementById('add-component-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('comp-name').value;
    const category = document.getElementById('comp-category').value;
    const quantity = document.getElementById('comp-qty').value;

    fetch(API_URL + '/components', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, quantity })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert("Error: " + data.error);
        } else {
            alert("Component Added Successfully!");
            document.getElementById('add-component-form').reset();
            loadInventory(); // Refresh table
        }
    })
    .catch(err => alert("Failed to add component"));
});

// Handle Issue Component
document.getElementById('issue-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const component_id = document.getElementById('issue-component').value;
    const quantity = document.getElementById('issue-qty').value;
    const person_name = document.getElementById('issue-person').value;

    fetch(API_URL + '/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component_id, quantity, person_name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert("Error: " + data.error);
        } else {
            alert("Component Issued Successfully!");
            document.getElementById('issue-form').reset();
            loadDropdowns(); // Refresh dropdowns
        }
    })
    .catch(err => alert("Failed to issue component"));
});

// Handle Return Component
document.getElementById('return-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const component_id = document.getElementById('return-component').value;
    const quantity = document.getElementById('return-qty').value;
    const person_name = document.getElementById('return-person').value;

    fetch(API_URL + '/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ component_id, quantity, person_name })
    })
    .then(res => res.json())
    .then(data => {
        if (data.error) {
            alert("Error: " + data.error);
        } else {
            alert("Component Returned Successfully!");
            document.getElementById('return-form').reset();
            loadDropdowns(); // Refresh dropdowns
        }
    })
    .catch(err => alert("Failed to return component"));
});

// Init load
window.onload = function() {
    loadDashboard();
};
