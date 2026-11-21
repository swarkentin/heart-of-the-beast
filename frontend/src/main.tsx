import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AudioPreview } from "./music/AudioPreview";
import { StoryPreview } from "./campaign/StoryPreview";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {new URLSearchParams(window.location.search).has("audio-preview") ? <AudioPreview /> : new URLSearchParams(window.location.search).has("story-preview") ? <StoryPreview /> : <App />}
  </React.StrictMode>,
);
