package api

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host, Port, Username, Password, From, TLSMode string
}

func (c SMTPConfig) valid() bool {
	port, err := strconv.Atoi(c.Port)
	return err == nil && port > 0 && port <= 65535 && c.Host != "" && validEmail(c.From) &&
		(c.TLSMode == "starttls" || c.TLSMode == "tls") && (c.Username == "") == (c.Password == "")
}

func (c SMTPConfig) SendCode(ctx context.Context, email, code string) error {
	if !c.valid() || !validEmail(email) || !validCode(code) {
		return errors.New("invalid mail configuration or recipient")
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", net.JoinHostPort(c.Host, c.Port))
	if err != nil {
		return err
	}
	defer conn.Close()
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()
	deadline, _ := ctx.Deadline()
	if err = conn.SetDeadline(deadline); err != nil {
		return err
	}
	tlsConfig := &tls.Config{ServerName: c.Host, MinVersion: tls.VersionTLS12}
	var transport net.Conn = conn
	if c.TLSMode == "tls" {
		secured := tls.Client(conn, tlsConfig)
		if err = secured.HandshakeContext(ctx); err != nil {
			return err
		}
		transport = secured
	}
	client, err := smtp.NewClient(transport, c.Host)
	if err != nil {
		return err
	}
	defer client.Close()
	if c.TLSMode == "starttls" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			return errors.New("SMTP server must support STARTTLS")
		}
		if err = client.StartTLS(tlsConfig); err != nil {
			return err
		}
	}
	if c.Username != "" {
		if err = client.Auth(smtp.PlainAuth("", c.Username, c.Password, c.Host)); err != nil {
			return err
		}
	}
	if err = client.Mail(c.From); err != nil {
		return err
	}
	if err = client.Rcpt(email); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	_, err = writer.Write([]byte(registrationMessage(c.From, email, code)))
	if err != nil {
		return err
	}
	// DATA acceptance confirms delivery to the relay; a failed QUIT must not invalidate the delivered code.
	if err = writer.Close(); err != nil {
		return err
	}
	return nil
}

func registrationMessage(from, email, code string) string {
	content := fmt.Sprintf("你的 Lumyvra 注册验证码是：%s\r\n\r\n验证码 10 分钟内有效，仅可使用一次。请勿分享给他人。\r\n如果你没有申请注册，请忽略此邮件。\r\n", code)
	encoded := base64.StdEncoding.EncodeToString([]byte(content))
	var lines []string
	for len(encoded) > 76 {
		lines = append(lines, encoded[:76])
		encoded = encoded[76:]
	}
	lines = append(lines, encoded)
	sender := (&mail.Address{Name: "Lumyvra", Address: from}).String()
	recipient := (&mail.Address{Address: email}).String()
	return "From: " + sender + "\r\nTo: " + recipient + "\r\nSubject: " + mime.QEncoding.Encode("UTF-8", "Lumyvra 注册验证码") +
		"\r\nDate: " + time.Now().Format(time.RFC1123Z) + "\r\nMessage-ID: <" + token() + "@" + from[strings.LastIndex(from, "@")+1:] +
		">\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" + strings.Join(lines, "\r\n") + "\r\n"
}
