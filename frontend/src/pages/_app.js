import React from "react";
import Head from "next/head";
import Navbar from "../components/Navbar";
import "../styles/globals.css";

export default function DepthWizardApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>DepthWizard – Calibrating AI Depth Models with Real-World Geographic Constraints</title>
        <meta
          name="description"
          content="Geospatial Intelligence Platform: Single-view satellite RGB image to metric elevation map (DEM) and interactive 3D terrain."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-geo-bg text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
        <Navbar />
        <main className="flex-1 pb-16">
          <Component {...pageProps} />
        </main>

        <footer className="border-t border-geo-border py-6 bg-geo-bg text-xs font-mono text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-slate-400 font-bold">DepthWizard</span> • Department of Computer Science and Engineering, Sahyadri College of Engineering and Management
            </div>
            <div>
              Guide: <span className="text-slate-300">Dr. Joyline Dsa</span> • Team: Siddu, Kaneez, Zaynah, Jenisha
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
