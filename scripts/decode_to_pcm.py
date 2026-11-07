import sys
import struct
import miniaudio

def main():
    if len(sys.argv) < 3:
        print("Usage: python decode_to_pcm.py <input_audio> <output_pcm>")
        sys.exit(1)

    in_path = sys.argv[1]
    out_path = sys.argv[2]

    try:
        decoded = miniaudio.decode_file(in_path)
    except Exception:
        with open(in_path, "rb") as f:
            data = f.read()
        if data[:3] == b'ID3':
            size = (data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9]
            has_footer = (data[5] & 0x10) != 0
            tag_len = 10 + size + (10 if has_footer else 0)
            data = data[tag_len:]
        idx = 0
        while idx < len(data) - 1:
            if data[idx] == 0xFF and (data[idx+1] & 0xE0) == 0xE0:
                break
            idx += 1
        decoded = miniaudio.decode(data[idx:])

    with open(out_path, "wb") as f:
        f.write(struct.pack("<ii", decoded.sample_rate, decoded.nchannels))
        f.write(decoded.samples.tobytes())

if __name__ == "__main__":
    main()
