import { fetchMonthlyStatsFromDB } from './src/services/dataService';

fetchMonthlyStatsFromDB().then(res => {
  console.log(JSON.stringify(res.monthlyStats.map(m => ({
    month: m.month,
    year: m.year,
    topDishesLength: m.topDishes.length,
    topDessertsLength: m.topDesserts.length,
    topDessertsEx: m.topDesserts.slice(0, 2)
  })), null, 2));
}).catch(console.error);
