import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeatureRequestPayload {
  request_text: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const payload: FeatureRequestPayload = await req.json();

    console.log("Received feature request:", {
      user_id: payload.user_id,
      user_name: payload.user_name,
      text_length: payload.request_text?.length,
    });

    // Insert into database
    const { data: featureRequest, error: dbError } = await supabase
      .from("feature_requests")
      .insert({
        user_id: payload.user_id || null,
        request_text: payload.request_text,
        user_email: payload.user_email || null,
        user_name: payload.user_name || null,
        status: "pending",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Failed to save feature request: ${dbError.message}`);
    }

    console.log("Feature request saved to database:", featureRequest.id);

    // Send email notification
    const submitterInfo = payload.user_name
      ? `${payload.user_name}${payload.user_email ? ` (${payload.user_email})` : ""}`
      : "Anonymous";

    const emailResponse = await resend.emails.send({
      from: "Hifdh it <onboarding@resend.dev>",
      to: ["Duaa.ali0105@gmail.com"],
      subject: "New Feature Request - Hifdh it",
      html: `
        <h2>New Feature Request Submitted</h2>
        
        <p><strong>Request:</strong></p>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${payload.request_text}</p>
        
        <hr style="margin: 20px 0;" />
        
        <p><strong>Submitted by:</strong> ${submitterInfo}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString('en-US', { 
          timeZone: 'UTC',
          dateStyle: 'full',
          timeStyle: 'long'
        })}</p>
        <p><strong>Request ID:</strong> ${featureRequest.id}</p>
        
        <hr style="margin: 20px 0;" />
        
        <p style="color: #666; font-size: 12px;">
          This is an automated notification from Hifdh it Feature Request System.
        </p>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Feature request submitted successfully",
        id: featureRequest.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-feature-request-email function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to submit feature request",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
