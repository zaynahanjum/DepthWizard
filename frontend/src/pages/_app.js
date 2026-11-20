import React from "react";
import Head from "next/head";
import Navbar from "../components/Navbar";
import "../styles/globals.css";

export default function DepthWizardApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>DepthWizard – Satellite Elevation & 3D Terrain Analysis</title>
        <meta
          name="description"
          content="Geospatial terrain elevation and 3D object height estimation from satellite imagery."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white">
        <Navbar />
        <main className="flex-1 pb-16">
          <Component {...pageProps} />
        </main>

        <footer className="border-t border-slate-200 py-6 bg-white text-xs text-slate-400">
          <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-slate-700">DepthWizard</span>
              <span>•</span>
              <span>Satellite & Aerial Elevation Intelligence</span>
            </div>
            <div className="text-slate-400">
              Sahyadri CSE Research • Dr. Joyline Dsa
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
