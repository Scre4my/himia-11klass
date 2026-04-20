/**
 * Модуль для генерации отчётов в PDF и Excel
 */

const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * Генерация PDF отчёта
 */
function generatePDFReport(calculationData, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Заголовок
    doc.fontSize(24).font('Helvetica-Bold').text('Отчёт расчёта выпарной батареи', {
      align: 'center'
    });
    doc.moveDown();

    // Дата создания
    doc.fontSize(12).font('Helvetica').text(`Дата создания: ${new Date().toLocaleDateString('ru-RU')}`, {
      align: 'center'
    });
    doc.moveDown(2);

    // Входные параметры
    doc.fontSize(16).font('Helvetica-Bold').text('Входные параметры:');
    doc.moveDown();
    
    const input = calculationData.input;
    const inputParams = [
      ['Тип установки', input.evaporatorType],
      ['Направление потока', input.flowDirection],
      ['Количество корпусов', input.numberOfEffects],
      ['Расход исходного раствора', `${input.feedFlowRate} кг/ч`],
      ['Начальная концентрация', `${input.initialConcentration}%`],
      ['Конечная концентрация', `${input.finalConcentration}%`],
      ['Температура греющего пара', `${input.steamTemperature}°C`],
      ['Коэффициент теплопередачи', `${input.heatTransferCoefficient} Вт/(м²·К)`],
      ['Теплота парообразования', `${input.vaporizationHeat} кДж/кг`],
      ['Теплота конденсации', `${input.condensationHeat} кДж/кг`]
    ];

    doc.fontSize(11).font('Helvetica');
    inputParams.forEach(([param, value]) => {
      doc.text(`${param}: ${value}`);
    });
    doc.moveDown();

    // Сводные данные
    doc.fontSize(16).font('Helvetica-Bold').text('Сводные данные:');
    doc.moveDown();

    const summaryData = [
      ['Общее количество испарённой воды', `${calculationData.totalEvaporatedWater.toFixed(2)} кг/ч`],
      ['Общий расход греющего пара', `${calculationData.totalSteamConsumption.toFixed(2)} кг/ч`],
      ['Паровая экономичность (W/D)', calculationData.steamEconomy.toFixed(2)],
      ['Общая площадь теплообмена', `${calculationData.totalHeatExchangeArea.toFixed(2)} м²`],
      ['Средняя площадь теплообмена', `${calculationData.averageHeatExchangeArea.toFixed(2)} м²`]
    ];

    doc.fontSize(11).font('Helvetica');
    summaryData.forEach(([param, value]) => {
      doc.text(`${param}: ${value}`);
    });
    doc.moveDown();

    // Таблица результатов по корпусам
    doc.fontSize(16).font('Helvetica-Bold').text('Результаты по корпусам:');
    doc.moveDown();

    // Заголовки таблицы
    const tableHeaders = ['№ корпуса', 'T, °C', 'P, МПа', 'Расход, кг/ч', 'W, кг/ч', 'C вх, %', 'C вых, %', 'D, кг/ч', 'F, м²', 'Q, кВт'];
    const tableWidth = doc.page.width - 100;
    const colWidths = tableHeaders.map(() => tableWidth / tableHeaders.length);

    // Заголовки
    let xPos = 50;
    let yPos = doc.y;
    
    doc.fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos, { width: colWidths[i], align: 'center' });
      xPos += colWidths[i];
    });
    
    yPos += 20;
    doc.moveTo(50, yPos).lineTo(doc.page.width - 50, yPos).stroke();
    yPos += 5;

    // Данные
    doc.fontSize(8).font('Helvetica');
    calculationData.stages.forEach(stage => {
      xPos = 50;
      const rowData = [
        stage.stageNumber.toString(),
        stage.temperature.toFixed(2),
        stage.pressure.toFixed(4),
        stage.feedFlowRate.toFixed(2),
        stage.evaporatedWater.toFixed(2),
        stage.concentrationIn.toFixed(2),
        stage.concentrationOut.toFixed(2),
        stage.steamConsumption.toFixed(2),
        stage.heatExchangeArea.toFixed(2),
        stage.heatLoad.toFixed(2)
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, xPos, yPos, { width: colWidths[i], align: 'center' });
        xPos += colWidths[i];
      });

      yPos += 15;
      
      // Проверка на выход за страницу
      if (yPos > doc.page.height - 50) {
        doc.addPage();
        yPos = 50;
      }
    });

    // Подпись
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica').text('_________________ /Фамилия И.О./', { align: 'right' });
    doc.text(`Дата: "${new Date().getDate()}" ${getMonthName(new Date().getMonth())} ${new Date().getFullYear()} г.`, { align: 'right' });

    doc.end();

    stream.on('finish', () => {
      resolve(outputPath);
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Генерация Excel файла
 */
function generateExcelReport(calculationData, outputPath) {
  const wb = XLSX.utils.book_init();

  // Лист с входными параметрами
  const inputData = [
    ['Параметр', 'Значение'],
    ['Тип установки', calculationData.input.evaporatorType],
    ['Направление потока', calculationData.input.flowDirection],
    ['Количество корпусов', calculationData.input.numberOfEffects],
    ['Расход исходного раствора (кг/ч)', calculationData.input.feedFlowRate],
    ['Начальная концентрация (%)', calculationData.input.initialConcentration],
    ['Конечная концентрация (%)', calculationData.input.finalConcentration],
    ['Температура греющего пара (°C)', calculationData.input.steamTemperature],
    ['Коэффициент теплопередачи (Вт/(м²·К))', calculationData.input.heatTransferCoefficient],
    ['Теплота парообразования (кДж/кг)', calculationData.input.vaporizationHeat],
    ['Теплота конденсации (кДж/кг)', calculationData.input.condensationHeat]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(inputData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Входные данные');

  // Лист со сводными данными
  const summaryData = [
    ['Показатель', 'Значение'],
    ['Общее количество испарённой воды (кг/ч)', calculationData.totalEvaporatedWater.toFixed(2)],
    ['Общий расход греющего пара (кг/ч)', calculationData.totalSteamConsumption.toFixed(2)],
    ['Паровая экономичность (W/D)', calculationData.steamEconomy.toFixed(2)],
    ['Общая площадь теплообмена (м²)', calculationData.totalHeatExchangeArea.toFixed(2)],
    ['Средняя площадь теплообмена (м²)', calculationData.averageHeatExchangeArea.toFixed(2)]
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws2, 'Сводные данные');

  // Лист с результатами по корпусам
  const stagesData = [
    ['№ корпуса', 'Температура (°C)', 'Давление (МПа)', 'Расход раствора (кг/ч)', 
     'Испарённая вода (кг/ч)', 'Концентрация вход (%)', 'Концентрация выход (%)',
     'Расход пара (кг/ч)', 'Площадь теплообмена (м²)', 'Тепловая нагрузка (кВт)']
  ];

  calculationData.stages.forEach(stage => {
    stagesData.push([
      stage.stageNumber,
      stage.temperature.toFixed(2),
      stage.pressure.toFixed(4),
      stage.feedFlowRate.toFixed(2),
      stage.evaporatedWater.toFixed(2),
      stage.concentrationIn.toFixed(2),
      stage.concentrationOut.toFixed(2),
      stage.steamConsumption.toFixed(2),
      stage.heatExchangeArea.toFixed(2),
      stage.heatLoad.toFixed(2)
    ]);
  });

  const ws3 = XLSX.utils.aoa_to_sheet(stagesData);
  
  // Настройка ширины колонок
  ws3['!cols'] = stagesData[0].map(() => ({ wch: 18 }));
  
  XLSX.utils.book_append_sheet(wb, ws3, 'Результаты по корпусам');

  // Сохранение файла
  XLSX.writeFile(wb, outputPath);
  
  return outputPath;
}

/**
 * Получить название месяца на русском
 */
function getMonthName(monthIndex) {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return months[monthIndex];
}

module.exports = {
  generatePDFReport,
  generateExcelReport
};
