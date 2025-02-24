let customers = [];
let operators = [];
let rooms = [];
let services = [];
let currentTimeTable = [];
let numberOfDayGlobal = 0;

async function loadData() {
    try {
        const [fCustomers, fOperators, fRooms, fServices] = await Promise.all([
            fetch('data/customers.json').then(res => res.json()),
            fetch('data/operators.json').then(res => res.json()),
            fetch('data/rooms.json').then(res => res.json()),
            fetch('data/services.json').then(res => res.json())
        ]);
        customers = fCustomers;
        operators = fOperators;
        rooms = fRooms;
        services = fServices;

        let timeTable = generateOptimizedTimetable(customers, services, rooms);
        numberOfDayGlobal = getMaxNumberOfDate(timeTable);
        let timeTableCustomer = convertToCustomerView(timeTable);
        let timeTableRoom = convertToRoomView(timeTable);
        currentTimeTable = timeTable;
        console.log(timeTable);
        console.log(timeTableCustomer);
        console.log(timeTableRoom);
        console.log(numberOfDayGlobal);
        drawTableByRoom(timeTableRoom, numberOfDayGlobal);
        drawTableByCustomer(timeTableCustomer, numberOfDayGlobal);
    } catch (error) {
        console.error("Error loading JSON files:", error);
    }
}

function getServiceColor(serviceId) {
    let service = services.find(s => s.id === serviceId);
    return service ? service.color : "#ccc";
}

function getRandomServices(services, n) {
    let shuffled = [...services].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

function formatTime(minutes) {
    let hours = Math.floor(minutes / 60);
    let mins = minutes % 60;
    let period = hours >= 12 ? "PM" : "AM";
    if (hours > 12) hours -= 12;
    return `${hours}:${mins.toString().padStart(2, '0')} ${period}`;
}


$(document).ready(function () {
    loadData();
});

function generateFlatTimetable(customers, services, rooms) {
    let appointments = []; // Danh sách lịch hẹn cuối cùng
    let startTime = 7 * 60;  // 7:00 AM (đổi sang phút)
    let endTime = 18 * 60;   // 6:00 PM (đổi sang phút)

    // Lưu lịch trình sử dụng của phòng và bệnh nhân theo ngày
    let roomSchedule = {};
    let customerSchedule = {};

    // Khởi tạo lịch trống cho từng phòng và bệnh nhân
    rooms.forEach(room => roomSchedule[room.id] = {});
    customers.forEach(customer => customerSchedule[customer.id] = {});

    // Duyệt qua từng bệnh nhân để lên lịch hẹn
    for (let customer of customers) {
        let selectedServices = getRandomServices(services, 10); // Chọn ngẫu nhiên 10 dịch vụ
        let day = 1; // Bắt đầu từ ngày 1
        let currentTime = startTime; // Bắt đầu từ 7:00 AM

        // Duyệt qua từng dịch vụ cần đặt cho bệnh nhân
        for (let service of selectedServices) {
            let serviceDuration = service.duration;
            let booked = false; // Đánh dấu đã đặt được dịch vụ chưa
            let availableRooms = rooms.filter(room => room.service_id === service.id);

            while (!booked) {
                if (!roomSchedule[day]) roomSchedule[day] = {};
                if (!customerSchedule[customer.id][day]) customerSchedule[customer.id][day] = [];

                let availableRoom = availableRooms.find(room => {
                    if (!roomSchedule[day][room.id]) roomSchedule[day][room.id] = [];
                    return !roomSchedule[day][room.id].some(b => b.end_time > currentTime);
                });

                let customerAvailable = !customerSchedule[customer.id][day].some(b => b.end_time > currentTime);

                if (availableRoom && customerAvailable && currentTime + serviceDuration <= endTime) {
                    let start_time = formatTime(currentTime);
                    let end_time = formatTime(currentTime + serviceDuration);

                    appointments.push({
                        day: day,
                        customer_id: customer.id,
                        customer_name: customer.name,
                        service_id: service.id,
                        service_name: service.name,
                        room_id: availableRoom.id,
                        room_name: availableRoom.name,
                        start_time: start_time,
                        end_time: end_time
                    });

                    roomSchedule[day][availableRoom.id].push({ start_time: currentTime, end_time: currentTime + serviceDuration });
                    customerSchedule[customer.id][day].push({ start_time: currentTime, end_time: currentTime + serviceDuration });

                    booked = true;
                    currentTime += serviceDuration;
                } else {
                    currentTime += 5;
                    if (currentTime + serviceDuration > endTime) {
                        day += 1; // Chuyển sang ngày tiếp theo
                        currentTime = startTime; // Reset thời gian bắt đầu
                    }
                }
            }
        }
    }
    return appointments;
}

function getMaxNumberOfDate(appointments) {
    if (!appointments || appointments.length === 0) return 0;

    let maxDay = Math.max(...appointments.map(appt => appt.day));
    return maxDay;
}

function generateOptimizedTimetable(customers, services, rooms) {
    let appointments = [];
    let startTime = 7 * 60;  // 7:00 AM (đổi sang phút)
    let endTime = 18 * 60;   // 6:00 PM (đổi sang phút)

    let roomSchedule = {};  // Lịch sử dụng phòng theo ngày
    let customerSchedule = {}; // Lịch của từng bệnh nhân
    let numberOfDay = 1;

    // Khởi tạo lịch trống cho từng phòng và từng bệnh nhân
    rooms.forEach(room => roomSchedule[room.id] = {});
    customers.forEach(customer => customerSchedule[customer.id] = {});

    let pendingAppointments = [];

    // Tạo danh sách chờ gồm tất cả bệnh nhân và dịch vụ họ cần làm
    customers.forEach(customer => {
        let selectedServices = getRandomServices(services, 10);
        selectedServices.forEach(service => {
            pendingAppointments.push({
                customer_id: customer.id,
                customer_name: customer.name,
                service_id: service.id,
                service_name: service.name,
                duration: service.duration
            });
        });
    });

    // Sắp xếp danh sách chờ ngẫu nhiên để trải đều lịch
    pendingAppointments.sort(() => Math.random() - 0.5);

    while (pendingAppointments.length > 0) {
        let appointment = pendingAppointments.shift();
        let availableRooms = rooms.filter(room => room.service_id === appointment.service_id);

        let booked = false;
        let day = 1;
        let currentTime = startTime;

        while (!booked) {
            if (!roomSchedule[day]) roomSchedule[day] = {};
            if (!customerSchedule[appointment.customer_id][day]) customerSchedule[appointment.customer_id][day] = [];

            // Tìm phòng nào có ít lịch nhất để xếp trước
            availableRooms.sort((a, b) => (roomSchedule[day][a.id]?.length || 0) - (roomSchedule[day][b.id]?.length || 0));

            for (let room of availableRooms) {
                if (!roomSchedule[day][room.id]) roomSchedule[day][room.id] = [];

                let serviceDuration = appointment.duration;

                // Tìm khoảng thời gian trống trong phòng
                let validSlot = findAvailableSlot(roomSchedule[day][room.id], customerSchedule[appointment.customer_id][day], startTime, endTime, serviceDuration);

                if (validSlot) {
                    let start_time = formatTime(validSlot.start);
                    let end_time = formatTime(validSlot.end);

                    // Lưu lịch hẹn
                    appointments.push({
                        day: day,
                        customer_id: appointment.customer_id,
                        customer_name: appointment.customer_name,
                        service_id: appointment.service_id,
                        service_name: appointment.service_name,
                        room_id: room.id,
                        room_name: room.name,
                        start_time: start_time,
                        end_time: end_time
                    });

                    // Cập nhật lịch phòng & bệnh nhân
                    roomSchedule[day][room.id].push(validSlot);
                    customerSchedule[appointment.customer_id][day].push(validSlot);

                    booked = true;
                    break;
                }
            }

            if (!booked) {
                day++;
                currentTime = startTime;
                numberOfDay = Math.max(numberOfDay, day);
            }
        }
    }

    return appointments;
}

// 📌 Hàm tìm khoảng thời gian trống không bị trùng lịch
function findAvailableSlot(roomBookings, customerBookings, startTime, endTime, duration) {
    let possibleStart = startTime;

    while (possibleStart + duration <= endTime) {
        let possibleEnd = possibleStart + duration;

        let roomConflict = roomBookings.some(booking => !(booking.end <= possibleStart || booking.start >= possibleEnd));
        let customerConflict = customerBookings.some(booking => !(booking.end <= possibleStart || booking.start >= possibleEnd));

        if (!roomConflict && !customerConflict) {
            return { start: possibleStart, end: possibleEnd };
        }

        possibleStart += 5; // Dời lịch 5 phút nếu không tìm được chỗ trống
    }

    return null;
}


// Chuyển đổi thành mảng theo customer
function convertToCustomerView(flatAppointments) {
    let customerMap = {};

    flatAppointments.forEach(app => {
        if (!customerMap[app.customer_id]) {
            customerMap[app.customer_id] = {
                customer: { id: app.customer_id, name: app.customer_name },
                appointments: []
            };
        }

        customerMap[app.customer_id].appointments.push({
            service: { id: app.service_id, name: app.service_name },
            room: { id: app.room_id, name: app.room_name },
            start_time: app.start_time,
            end_time: app.end_time,
            day: app.day
        });
    });

    return Object.values(customerMap);
}

// Chuyển đổi thành mảng theo room
function convertToRoomView(flatAppointments) {
    let roomMap = {};

    flatAppointments.forEach(app => {
        if (!roomMap[app.room_id]) {
            roomMap[app.room_id] = {
                room: { id: app.room_id, name: app.room_name },
                appointments: []
            };
        }

        roomMap[app.room_id].appointments.push({
            service: { id: app.service_id, name: app.service_name },
            customer: { id: app.customer_id, name: app.customer_name },
            start_time: app.start_time,
            end_time: app.end_time,
            day: app.day
        });
    });

    return Object.values(roomMap);
}

function drawTableByCustomer(timeTable, numberOfDay) {
    let startTime = 7 * 60; // 7:00 AM -> phút
    let endTime = 18 * 60;  // 6:00 PM -> phút
    let timeSlotsPerDay = [];
    let table = $("#timetable-customer").empty();

    // Hàng hiển thị ngày
    let dayRow = $("<tr>");
    dayRow.append("<th class='sticky-column' rowspan='2'>Khách Hàng</th>"); // Cột khách hàng

    for (let day = 1; day <= numberOfDay; day++) {
        let timeSlots = [];
        for (let t = startTime; t <= endTime; t += 5) {
            timeSlots.push(formatTime(t));
        }
        timeSlotsPerDay.push(timeSlots);
        dayRow.append(`<th class='day-header day-cell day-${day}' colspan='${timeSlots.length}'>Ngày ${day}</th>`);
    }
    table.append(dayRow);

    // Hàng hiển thị các mốc thời gian
    let timeRow = $("<tr>");
    for (let day = 1; day <= numberOfDay; day++) {
        timeSlotsPerDay[day - 1].forEach((time, index) => {
            let cell = $(`<th>${time}</th>`);
            if (index === timeSlotsPerDay[day - 1].length - 1) {
                cell.css("border-right", "3px solid black"); // Border đậm cuối ngày
            }
            timeRow.append(cell);
        });
    }
    table.append(timeRow);

    // Vẽ dữ liệu bảng
    timeTable.forEach(entry => {
        let row = $("<tr>");
        row.append(`<td class='customer-name sticky-column'>${entry.customer.name}</td>`);

        let cells = [];
        for (let day = 1; day <= numberOfDay; day++) {
            let dailyAppointments = entry.appointments.filter(appt => appt.day === day);
            let dayCells = timeSlotsPerDay[day - 1].map((_, index) => {
                let cell = $("<td></td>");
                if (index === timeSlotsPerDay[day - 1].length - 1) {
                    cell.css("border-right", "3px solid black"); // Border đậm cuối ngày
                }
                return cell;
            });

            dailyAppointments.forEach(appointment => {
                let startIdx = timeSlotsPerDay[day - 1].indexOf(appointment.start_time);
                let endIdx = timeSlotsPerDay[day - 1].indexOf(appointment.end_time);
                let color = getServiceColor(appointment.service.id);

                if (startIdx !== -1 && endIdx !== -1) {
                    let durationSlots = endIdx - startIdx;
                    for (let i = startIdx + 1; i < endIdx; i++) dayCells[i] = null;

                    let cell = $(`<td colspan='${durationSlots}' class='service-box'></td>`);
                    let serviceDiv = $(`
                        <div class='service-content' style='background: ${color}' draggable='true'>
                            <b>${appointment.service.name}</b><br>
                            🚪 Phòng: ${appointment.room.name}<br>
                            ⏳ ${appointment.start_time} - ${appointment.end_time}
                        </div>
                    `);

                    serviceDiv.data("tooltip", `
                        👤 <b>${entry.customer.name}</b><br>
                        🏷️ <b>Dịch vụ:</b> ${appointment.service.name}<br>
                        🚪 <b>Phòng:</b> ${appointment.room.name}<br>
                        ⏳ <b>Thời gian:</b> ${appointment.start_time} - ${appointment.end_time}
                    `);

                    cell.append(serviceDiv);
                    dayCells[startIdx] = cell;
                }
            });

            cells.push(...dayCells);
        }

        cells.forEach(cell => {
            if (cell !== null) row.append(cell);
        });

        table.append(row);
    });

    let tooltipTimeout;
    let tooltip = $("#tooltip");
    let lastMouseMove = 0;

    $(".service-content").hover(function (event) {
        clearTimeout(tooltipTimeout);
        tooltip.html($(this).data("tooltip"))
            .css({ top: event.pageY + 15, left: event.pageX + 15 })
            .stop(true, true).fadeIn(200);
    }, function () {
        tooltipTimeout = setTimeout(() => tooltip.fadeOut(200), 300);
    });

    $(document).mousemove(function (event) {
        let now = performance.now();
        if (now - lastMouseMove > 30) {
            lastMouseMove = now;
            requestAnimationFrame(() => {
                tooltip.css({ top: event.pageY + 15, left: event.pageX + 15 });
            });
        }
    });

    tooltip.hover(() => clearTimeout(tooltipTimeout), () => {
        tooltipTimeout = setTimeout(() => tooltip.fadeOut(200), 300);
    });
}

function drawTableByRoom(timeTable, numberOfDay) {
    let startTime = 7 * 60; // 7:00 AM -> phút
    let endTime = 18 * 60;  // 6:00 PM -> phút
    let timeSlotsPerDay = [];
    let table = $("#timetable-room").empty();

    // Hàng hiển thị ngày
    let dayRow = $("<tr>");
    dayRow.append("<th class='sticky-column' rowspan='2'>Phòng</th>"); // Cột phòng

    for (let day = 1; day <= numberOfDay; day++) {
        let timeSlots = [];
        for (let t = startTime; t <= endTime; t += 5) {
            timeSlots.push(formatTime(t));
        }
        timeSlotsPerDay.push(timeSlots);
        dayRow.append(`<th class='day-header day-cell day-${day}' colspan='${timeSlots.length}'>Ngày ${day}</th>`);
    }
    table.append(dayRow);

    // Hàng hiển thị các mốc thời gian
    let timeRow = $("<tr>");
    for (let day = 1; day <= numberOfDay; day++) {
        timeSlotsPerDay[day - 1].forEach((time, index) => {
            let cell = $(`<th>${time}</th>`);
            if (index === timeSlotsPerDay[day - 1].length - 1) {
                cell.css("border-right", "3px solid black"); // Border đậm cuối ngày
            }
            timeRow.append(cell);
        });
    }
    table.append(timeRow);

    // Vẽ dữ liệu bảng
    timeTable.forEach(entry => {
        let row = $("<tr>");
        row.append(`<td class='room-name sticky-column'>${entry.room.name}</td>`);

        let cells = [];
        for (let day = 1; day <= numberOfDay; day++) {
            let dailyAppointments = entry.appointments.filter(appt => appt.day === day);
            let dayCells = timeSlotsPerDay[day - 1].map((_, index) => {
                let cell = $("<td></td>");
                if (index === timeSlotsPerDay[day - 1].length - 1) {
                    cell.css("border-right", "3px solid black"); // Border đậm cuối ngày
                }
                return cell;
            });

            dailyAppointments.forEach(appointment => {
                let startIdx = timeSlotsPerDay[day - 1].indexOf(appointment.start_time);
                let endIdx = timeSlotsPerDay[day - 1].indexOf(appointment.end_time);
                let color = getServiceColor(appointment.service.id);

                if (startIdx !== -1 && endIdx !== -1) {
                    let durationSlots = endIdx - startIdx;
                    for (let i = startIdx + 1; i < endIdx; i++) dayCells[i] = null;

                    let cell = $(`<td colspan='${durationSlots}' class='service-box'></td>`);
                    let serviceDiv = $(`
                        <div class='service-content' style='background: ${color}' draggable='true'>
                            <b>${appointment.service.name}</b><br>
                            👤 Khách: ${appointment.customer.name}<br>
                            ⏳ ${appointment.start_time} - ${appointment.end_time}
                        </div>
                    `);

                    serviceDiv.data("tooltip", `
                        🚪 <b>Phòng:</b> ${entry.room.name}<br>
                        👤 <b>Khách:</b> ${appointment.customer.name}<br>
                        🏷️ <b>Dịch vụ:</b> ${appointment.service.name}<br>
                        ⏳ <b>Thời gian:</b> ${appointment.start_time} - ${appointment.end_time}
                    `);

                    cell.append(serviceDiv);
                    dayCells[startIdx] = cell;
                }
            });

            cells.push(...dayCells);
        }

        cells.forEach(cell => {
            if (cell !== null) row.append(cell);
        });

        table.append(row);
    });

    let tooltipTimeout;
    let tooltip = $("#tooltip");
    let lastMouseMove = 0;

    $(".service-content").hover(function (event) {
        clearTimeout(tooltipTimeout);
        tooltip.html($(this).data("tooltip"))
            .css({ top: event.pageY + 15, left: event.pageX + 15 })
            .stop(true, true).fadeIn(200);
    }, function () {
        tooltipTimeout = setTimeout(() => tooltip.fadeOut(200), 300);
    });

    $(document).mousemove(function (event) {
        let now = performance.now();
        if (now - lastMouseMove > 30) {
            lastMouseMove = now;
            requestAnimationFrame(() => {
                tooltip.css({ top: event.pageY + 15, left: event.pageX + 15 });
            });
        }
    });

    tooltip.hover(() => clearTimeout(tooltipTimeout), () => {
        tooltipTimeout = setTimeout(() => tooltip.fadeOut(200), 300);
    });
}

