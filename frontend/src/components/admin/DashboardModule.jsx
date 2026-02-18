import React, { useMemo } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

const DashboardModule = React.memo(({ appointments, users, piojologists, formatCurrency }) => {
  
  const stats = useMemo(() => {
    const pending = appointments.filter(a => a.status === 'pending').length;
    const completed = appointments.filter(a => a.status === 'completed').length;
    const totalRevenue = appointments
      .filter(a => a.status === 'completed')
      .reduce((sum, a) => sum + (a.price_confirmed || a.estimatedPrice || 0), 0);
    const activePiojologists = piojologists.filter(u => u.available).length;

    return {
      pending,
      completed,
      totalRevenue,
      activePiojologists,
      totalUsers: users.length
    };
  }, [appointments, users, piojologists]);

  const serviceDistribution = useMemo(() => {
    const services = ['Normal', 'Elevado', 'Muy Alto'];
    return services.map(service => 
      appointments.filter(a => a.serviceType === service).length
    );
  }, [appointments]);

  const weeklyData = useMemo(() => {
    return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day, idx) => {
      const today = new Date();
      const daysBack = 6 - idx;
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - daysBack);
      
      return appointments.filter(a => {
        const apt = new Date(a.date);
        return apt.toDateString() === checkDate.toDateString();
      }).length;
    });
  }, [appointments]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-yellow-400 to-orange-400 rounded-[2.5rem] p-6 shadow-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold opacity-90 uppercase tracking-wide">Pendientes</p>
              <p className="text-4xl font-black mt-2">{stats.pending}</p>
            </div>
            <div className="text-5xl opacity-80">⏳</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-400 to-emerald-500 rounded-[2.5rem] p-6 shadow-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold opacity-90 uppercase tracking-wide">Completados</p>
              <p className="text-4xl font-black mt-2">{stats.completed}</p>
            </div>
            <div className="text-5xl opacity-80">✅</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-400 to-cyan-500 rounded-[2.5rem] p-6 shadow-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold opacity-90 uppercase tracking-wide">Ingresos</p>
              <p className="text-2xl font-black mt-2">{formatCurrency(stats.totalRevenue)}</p>
            </div>
            <div className="text-5xl opacity-80">💰</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-400 to-pink-500 rounded-[2.5rem] p-6 shadow-xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold opacity-90 uppercase tracking-wide">Piojólogas</p>
              <p className="text-4xl font-black mt-2">{stats.activePiojologists}</p>
            </div>
            <div className="text-5xl opacity-80">👩‍⚕️</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Distribution */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-pink-100">
          <h3 className="text-2xl font-black text-gray-800 mb-6">📊 Distribución de Servicios</h3>
          <div className="h-80">
            <Bar
              data={{
                labels: ['Normal', 'Elevado', 'Muy Alto'],
                datasets: [{
                  label: 'Servicios',
                  data: serviceDistribution,
                  backgroundColor: ['#EC4899', '#F472B6', '#F9A8D4'],
                  borderColor: '#BE185D',
                  borderWidth: 2,
                  borderRadius: 8
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  x: { beginAtZero: true }
                }
              }}
            />
          </div>
        </div>

        {/* Weekly Performance */}
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border-4 border-orange-100">
          <h3 className="text-2xl font-black text-gray-800 mb-6">📈 Desempeño Semanal</h3>
          <div className="h-80">
            <Line
              data={{
                labels: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
                datasets: [{
                  label: 'Citas por Día',
                  data: weeklyData,
                  backgroundColor: 'rgba(251, 191, 36, 0.1)',
                  borderColor: '#F59E0B',
                  borderWidth: 3,
                  fill: true,
                  tension: 0.4
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                },
                scales: {
                  y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

DashboardModule.displayName = 'DashboardModule';

export default DashboardModule;
