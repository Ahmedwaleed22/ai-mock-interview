import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  httpAgent: undefined,
  timeout: 120000, // 2 minute timeout for TTS generation
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = "coral", instructions, response_format = "mp3" } = body;

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    console.log(`Generating speech for ${text.length} characters, format: ${response_format}`);

    // Create speech with the requested format
    const speechResponse = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" | "coral" | "ash" | "ballad" | "cove" | "sage" | "verse",
      input: text,
      ...(instructions && { instructions }),
      response_format: response_format as "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm",
    });

    console.log("Speech response received from OpenAI");

    // Get the stream from the response
    const stream = speechResponse.body as ReadableStream<Uint8Array>;
    
    if (!stream) {
      console.error("No stream in speech response");
      return NextResponse.json(
        { error: "Failed to get audio stream from OpenAI" },
        { status: 500 }
      );
    }
    
    // Map formats to correct MIME types
    const contentTypeMap: Record<string, string> = {
      mp3: "audio/mpeg",
      opus: "audio/ogg; codecs=opus",
      aac: "audio/aac",
      flac: "audio/flac",
      wav: "audio/wav",
      pcm: "audio/pcm"
    };
    
    const contentType = contentTypeMap[response_format] || "audio/mpeg";
    
    console.log(`Streaming response with content-type: ${contentType}`);
    
    // Create a pass-through stream that logs data flow
    const transformStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        console.log(`Streaming chunk: ${chunk.byteLength} bytes`);
        controller.enqueue(chunk);
      }
    });

    // Stream through the transform to log, then to response
    const streamedResponse = stream.pipeThrough(transformStream);
    
    return new NextResponse(streamedResponse, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="speech.${response_format}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Transfer-Encoding": "chunked",
        "X-Content-Type-Options": "nosniff",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error generating speech:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate speech";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
