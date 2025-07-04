import React, { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
  Filler
);

// Athletes by Sport Chart (Doughnut)
export const AthletesBySportChart = ({ orgStats }) => {
  if (!orgStats.sportStats) return null;

  const sports = Object.entries(orgStats.sportStats)
    .filter(([sport, stats]) => stats.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8); // Top 8 sports

  if (sports.length === 0) return null;

  const data = {
    labels: sports.map(([sport]) => sport),
    datasets: [
      {
        data: sports.map(([sport, stats]) => stats.total),
        backgroundColor: [
          "#FF6384",
          "#36A2EB",
          "#FFCE56",
          "#4BC0C0",
          "#9966FF",
          "#FF9F40",
          "#FF6384",
          "#C9CBCF",
        ],
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} athletes (${percentage}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
};

// Photography Progress Chart (Doughnut)
export const PhotographyProgressChart = ({ orgStats }) => {
  const photographed = orgStats.totalPhotographed || 0;
  const notPhotographed = (orgStats.totalAthletes || 0) - photographed;

  if (photographed === 0 && notPhotographed === 0) return null;

  const data = {
    labels: ["Photographed", "Not Photographed"],
    datasets: [
      {
        data: [photographed, notPhotographed],
        backgroundColor: ["#28A745", "#DC3545"],
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} athletes (${percentage}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
};

// Season Distribution Chart (Doughnut)
export const SeasonDistributionChart = ({ orgStats }) => {
  if (!orgStats.seasonStats) return null;

  const seasons = Object.entries(orgStats.seasonStats).filter(
    ([season, stats]) => stats.total > 0
  );

  if (seasons.length === 0) return null;

  const data = {
    labels: seasons.map(([season]) => season.replace(" Sports", "")),
    datasets: [
      {
        data: seasons.map(([season, stats]) => stats.total),
        backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0"],
        borderWidth: 2,
        borderColor: "#fff",
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(1) : 0;
            return `${label}: ${value} athletes (${percentage}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
};

// Sports Completion Progress Chart (Bar)
export const SportsCompletionChart = ({ orgStats }) => {
  if (!orgStats.sportStats) return null;

  const sports = Object.entries(orgStats.sportStats)
    .filter(([sport, stats]) => stats.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10); // Top 10 sports

  if (sports.length === 0) return null;

  const data = {
    labels: sports.map(([sport]) =>
      sport.length > 15 ? sport.substring(0, 15) + "..." : sport
    ),
    datasets: [
      {
        label: "Total Athletes",
        data: sports.map(([sport, stats]) => stats.total),
        backgroundColor: "#E3F2FD",
        borderColor: "#2196F3",
        borderWidth: 1,
      },
      {
        label: "Photographed",
        data: sports.map(([sport, stats]) => stats.photographed),
        backgroundColor: "#E8F5E8",
        borderColor: "#4CAF50",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Sports Photography Progress",
      },
      tooltip: {
        callbacks: {
          afterLabel: function (context) {
            const sportName = sports[context.dataIndex][0];
            const stats = sports[context.dataIndex][1];
            const percentage =
              stats.total > 0
                ? ((stats.photographed / stats.total) * 100).toFixed(1)
                : 0;
            return `Completion: ${percentage}%`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 0,
        },
      },
    },
  };

  return <Bar data={data} options={options} />;
};

// Monthly Progress Chart (Line)
export const MonthlyProgressChart = ({ monthlyData }) => {
  if (!monthlyData || monthlyData.length === 0) return null;

  const data = {
    labels: monthlyData.map((item) => item.month),
    datasets: [
      {
        label: "Athletes Photographed",
        data: monthlyData.map((item) => item.photographed),
        borderColor: "#4CAF50",
        backgroundColor: "rgba(76, 175, 80, 0.1)",
        tension: 0.4,
        fill: true,
      },
      {
        label: "Total Athletes",
        data: monthlyData.map((item) => item.total),
        borderColor: "#2196F3",
        backgroundColor: "rgba(33, 150, 243, 0.1)",
        tension: 0.4,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Monthly Photography Progress",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return <Line data={data} options={options} />;
};

// School Performance Chart (Horizontal Bar)
export const SchoolPerformanceChart = ({ schoolStats }) => {
  if (!schoolStats || schoolStats.length === 0) return null;

  const sortedSchools = schoolStats
    .sort((a, b) => b.completionPercentage - a.completionPercentage)
    .slice(0, 10); // Top 10 schools

  const data = {
    labels: sortedSchools.map((school) =>
      school.name.length > 20
        ? school.name.substring(0, 20) + "..."
        : school.name
    ),
    datasets: [
      {
        label: "Completion Percentage",
        data: sortedSchools.map((school) => school.completionPercentage),
        backgroundColor: sortedSchools.map((school) => {
          const percentage = school.completionPercentage;
          if (percentage >= 90) return "#4CAF50";
          if (percentage >= 70) return "#FF9800";
          return "#F44336";
        }),
        borderColor: "#fff",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: "School Performance (Completion %)",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            return `${context.parsed.x.toFixed(1)}% completed`;
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function (value) {
            return value + "%";
          },
        },
      },
    },
  };

  return <Bar data={data} options={options} />;
};
