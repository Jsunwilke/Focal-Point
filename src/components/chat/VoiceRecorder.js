import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X } from 'lucide-react';
import './VoiceRecorder.css';

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendRecording = async () => {
    if (audioBlob) {
      await onSend(audioBlob, recordingTime);
      cancelRecording();
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setRecordingTime(0);
    if (onCancel) onCancel();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-recorder">
      {!isRecording && !audioBlob && (
        <button
          className="voice-recorder__start"
          onClick={startRecording}
          title="Start voice recording"
        >
          <Mic size={20} />
        </button>
      )}

      {isRecording && (
        <div className="voice-recorder__recording">
          <button
            className="voice-recorder__stop"
            onClick={stopRecording}
          >
            <MicOff size={20} />
          </button>
          <div className="voice-recorder__time">
            <span className="voice-recorder__pulse"></span>
            {formatTime(recordingTime)}
          </div>
          <button
            className="voice-recorder__cancel"
            onClick={cancelRecording}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {audioBlob && !isRecording && (
        <div className="voice-recorder__preview">
          <audio
            controls
            src={URL.createObjectURL(audioBlob)}
            className="voice-recorder__audio"
          />
          <div className="voice-recorder__actions">
            <button
              className="voice-recorder__send"
              onClick={sendRecording}
            >
              <Send size={20} />
            </button>
            <button
              className="voice-recorder__cancel"
              onClick={cancelRecording}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;